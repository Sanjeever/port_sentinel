package ports

import (
	"bytes"
	"context"
	"encoding/binary"
	"fmt"
	"net"
	"strconv"
	"unsafe"

	"golang.org/x/sys/windows"
)

var iphelper = windows.NewLazySystemDLL("iphlpapi.dll")
var tcpStates = []string{"", "CLOSED", "LISTEN", "SYN_SENT", "SYN_RECEIVED", "ESTABLISHED", "FIN_WAIT_1", "FIN_WAIT_2", "CLOSE_WAIT", "CLOSING", "LAST_ACK", "TIME_WAIT", "DELETE_TCB"}

func connections(ctx context.Context) ([]Entry, error) {
	entries := []Entry{}
	for _, family := range []uint32{windows.AF_INET, windows.AF_INET6} {
		for _, tcp := range []bool{true, false} {
			if err := ctx.Err(); err != nil {
				return nil, err
			}
			name := "GetExtendedUdpTable"
			class := uintptr(1)
			if tcp {
				name = "GetExtendedTcpTable"
				class = 5
			}
			proc := iphelper.NewProc(name)
			var size uint32
			r, _, _ := proc.Call(0, uintptr(unsafe.Pointer(&size)), 0, uintptr(family), class, 0)
			if r != uintptr(windows.ERROR_INSUFFICIENT_BUFFER) && r != 0 {
				return nil, windows.Errno(r)
			}
			var data []byte
			for attempt := 0; attempt < 4; attempt++ {
				data = make([]byte, size)
				r, _, _ = proc.Call(uintptr(unsafe.Pointer(&data[0])), uintptr(unsafe.Pointer(&size)), 0, uintptr(family), class, 0)
				if r != uintptr(windows.ERROR_INSUFFICIENT_BUFFER) {
					break
				}
			}
			if r != 0 {
				return nil, windows.Errno(r)
			}
			rows, err := parseWindowsTable(data, tcp, family == windows.AF_INET6)
			if err != nil {
				return nil, err
			}
			entries = append(entries, rows...)
		}
	}
	return entries, nil
}

func parseWindowsTable(data []byte, tcp, ipv6 bool) ([]Entry, error) {
	r := bytes.NewReader(data)
	var count uint32
	if err := binary.Read(r, binary.LittleEndian, &count); err != nil {
		return nil, err
	}
	entries := []Entry{}
	for n := uint32(0); n < count; n++ {
		var state, pid, lp, rp, scope, rscope uint32
		var local, remote net.IP
		read := func(v any) error { return binary.Read(r, binary.LittleEndian, v) }
		if !ipv6 {
			var laddr, raddr [4]byte
			if tcp {
				if err := read(&state); err != nil {
					return nil, err
				}
			}
			if err := read(&laddr); err != nil {
				return nil, err
			}
			if err := read(&lp); err != nil {
				return nil, err
			}
			if tcp {
				if err := read(&raddr); err != nil {
					return nil, err
				}
				if err := read(&rp); err != nil {
					return nil, err
				}
			}
			local = net.IP(laddr[:])
			remote = net.IP(raddr[:])
		} else {
			var laddr, raddr [16]byte
			for _, v := range []any{&laddr, &scope, &lp} {
				if err := read(v); err != nil {
					return nil, err
				}
			}
			if tcp {
				for _, v := range []any{&raddr, &rscope, &rp, &state} {
					if err := read(v); err != nil {
						return nil, err
					}
				}
			}
			local = net.IP(laddr[:])
			remote = net.IP(raddr[:])
		}
		if err := read(&pid); err != nil {
			return nil, err
		}
		port := uint32(uint16(lp&255)<<8 | uint16(lp>>8&255))
		remotePort := uint32(uint16(rp&255)<<8 | uint16(rp>>8&255))
		ip := local.String()
		if scope != 0 {
			ip += "%" + strconv.Itoa(int(scope))
		}
		e := Entry{Protocol: "UDP", Port: port, Local: net.JoinHostPort(ip, strconv.Itoa(int(port))), State: "BOUND", Process: Identity{PID: int32(pid)}}
		if tcp {
			if int(state) >= len(tcpStates) {
				return nil, fmt.Errorf("invalid TCP state %d", state)
			}
			e.Protocol = "TCP"
			e.State = tcpStates[state]
		}
		if remotePort != 0 {
			ip = remote.String()
			if rscope != 0 {
				ip += "%" + strconv.Itoa(int(rscope))
			}
			v := net.JoinHostPort(ip, strconv.Itoa(int(remotePort)))
			e.Remote = &v
		}
		if port != 0 {
			entries = append(entries, e)
		}
	}
	return entries, nil
}
