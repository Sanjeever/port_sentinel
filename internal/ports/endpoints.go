package ports

import (
	"net/netip"
	"sort"
)

type EndpointBinding struct {
	Local   string         `json:"local"`
	Process ProcessSummary `json:"process"`
	Status  string         `json:"status"`
}

type EndpointResult struct {
	Protocol string            `json:"protocol"`
	Local    string            `json:"local"`
	Status   string            `json:"status"`
	Bindings []EndpointBinding `json:"bindings"`
}

type protocolPort struct {
	protocol string
	port     uint32
}

type endpointKey struct {
	protocolPort
	local string
}

// RecheckEndpoints 根据操作前后的快照核对目标进程关联的监听和绑定。
func RecheckEndpoints(before, after Snapshot, targets []Identity, scanErr error) []EndpointResult {
	targetsByID := make(map[string]bool, len(targets))
	for _, p := range targets {
		targetsByID[p.Key()] = true
	}
	previous := map[endpointKey]map[int32]int64{}
	relevantPorts := map[protocolPort]bool{}
	var endpoints []endpointKey
	for _, e := range before.Entries {
		if !isBinding(e) || !targetsByID[e.Process.Key()] {
			continue
		}
		key := endpointKey{protocolPort{e.Protocol, e.Port}, e.Local}
		if previous[key] == nil {
			endpoints = append(endpoints, key)
			previous[key] = map[int32]int64{}
			relevantPorts[key.protocolPort] = true
		}
		previous[key][e.Process.PID] = e.Process.Created
	}
	sort.Slice(endpoints, func(i, j int) bool {
		a, b := endpoints[i], endpoints[j]
		if a.port != b.port {
			return a.port < b.port
		}
		if a.protocol != b.protocol {
			return a.protocol < b.protocol
		}
		return a.local < b.local
	})
	current := map[protocolPort][]Entry{}
	for _, e := range after.Entries {
		key := protocolPort{e.Protocol, e.Port}
		if relevantPorts[key] && isBinding(e) {
			current[key] = append(current[key], e)
		}
	}
	results := make([]EndpointResult, 0, len(endpoints))
	for _, key := range endpoints {
		result := EndpointResult{Protocol: key.protocol, Local: key.local, Bindings: []EndpointBinding{}}
		if scanErr != nil {
			result.Status = "recheck_failed"
		} else {
			result.Bindings = recheckedBindings(key.local, previous[key], current[key.protocolPort])
			switch {
			case len(result.Bindings) > 0:
				result.Status = "bindings_found"
			case before.Visibility == "authorized" && after.Visibility != "authorized":
				result.Status = "visibility_changed"
			default:
				result.Status = "binding_unseen"
			}
		}
		results = append(results, result)
	}
	return results
}

func isBinding(e Entry) bool {
	return e.Port > 0 && e.Local != "" && (e.Protocol == "TCP" && e.State == "LISTEN" || e.Protocol == "UDP" && e.State == "BOUND")
}

func recheckedBindings(local string, previous map[int32]int64, entries []Entry) []EndpointBinding {
	type bindingKey struct {
		local   string
		pid     int32
		created int64
	}
	seen := map[bindingKey]bool{}
	bindings := []EndpointBinding{}
	for _, e := range entries {
		if !overlapsBinding(local, e.Local) {
			continue
		}
		p := e.Process
		key := bindingKey{e.Local, p.PID, p.Created}
		if seen[key] {
			continue
		}
		seen[key] = true
		status := "binding_other_process"
		created, hadPID := previous[p.PID]
		switch {
		case p.PID <= 0 || hadPID && p.Created <= 0:
			status = "binding_owner_unknown"
		case hadPID && p.Created == created:
			status = "binding_same_process"
		}
		bindings = append(bindings, EndpointBinding{
			Local: e.Local, Process: ProcessSummary{PID: p.PID, Created: p.Created, Name: p.Name}, Status: status,
		})
	}
	return bindings
}

func overlapsBinding(a, b string) bool {
	if a == b {
		return true
	}
	left, leftErr := netip.ParseAddrPort(a)
	right, rightErr := netip.ParseAddrPort(b)
	if leftErr != nil || rightErr != nil {
		return false
	}
	// 同一地址族的通配绑定覆盖具体地址。IPv6 通配是否接收 IPv4 取决于套接字选项。
	x, y := left.Addr().Unmap(), right.Addr().Unmap()
	return x == y || x.BitLen() == y.BitLen() && (x.IsUnspecified() || y.IsUnspecified())
}
