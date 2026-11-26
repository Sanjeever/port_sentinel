package ports

import (
	"errors"
	"testing"
)

func TestRecheckEndpointsMatchesBindingsAndRetainsEveryOwner(t *testing.T) {
	a := Identity{PID: 20, Created: 100}
	b := Identity{PID: 21, Created: 200}
	listener := Entry{Protocol: "TCP", Local: "127.0.0.1:8000", Port: 8000, State: "LISTEN", Process: a}
	wildcard := Entry{Protocol: "TCP", Local: "0.0.0.0:8000", Port: 8000, State: "LISTEN", Process: b}
	reused := listener
	reused.Process.Created++
	unknown := listener
	unknown.Process.Created = 0
	connection := listener
	connection.State = "TIME_WAIT"
	differentAddress := listener
	differentAddress.Local = "127.0.0.2:8000"
	differentProtocol := listener
	differentProtocol.Protocol, differentProtocol.State = "UDP", "BOUND"
	result := RecheckEndpoints(Snapshot{Entries: []Entry{listener, listener}}, Snapshot{
		Entries: []Entry{listener, wildcard, reused, unknown, wildcard, connection, differentAddress, differentProtocol},
	}, []Identity{a}, nil)
	if len(result) != 1 || result[0].Status != "bindings_found" || result[0].Local != listener.Local || len(result[0].Bindings) != 4 {
		t.Fatalf("unexpected endpoint results: %+v", result)
	}
	bindings := result[0].Bindings
	if bindings[0].Status != "binding_same_process" || bindings[1].Status != "binding_other_process" || bindings[1].Local != wildcard.Local ||
		bindings[2].Status != "binding_other_process" || bindings[2].Process.PID != a.PID || bindings[3].Status != "binding_owner_unknown" {
		t.Fatalf("unexpected owners: %+v", bindings)
	}
}

func TestRecheckEndpointsDistinguishesMissingBindingsFromInconclusiveScans(t *testing.T) {
	target := Identity{PID: 20, Created: 100}
	bound := Entry{Protocol: "UDP", Local: "[::]:5353", Port: 5353, State: "BOUND", Process: target}
	otherFamily := bound
	otherFamily.Local = "0.0.0.0:5353"
	connection := Entry{Protocol: "TCP", Local: "127.0.0.1:41414", Port: 41414, State: "ESTABLISHED", Process: target}
	for _, tt := range []struct {
		visibility string
		err        error
		want       string
	}{
		{visibility: "ordinary", want: "binding_unseen"},
		{visibility: "authorized", want: "visibility_changed"},
		{visibility: "ordinary", err: errors.New("failed"), want: "recheck_failed"},
	} {
		t.Run(tt.want, func(t *testing.T) {
			before := Snapshot{Entries: []Entry{bound, connection}, Visibility: tt.visibility}
			after := Snapshot{Entries: []Entry{otherFamily}, Visibility: "ordinary"}
			result := RecheckEndpoints(before, after, []Identity{target}, tt.err)
			if len(result) != 1 || result[0].Status != tt.want || len(result[0].Bindings) > 0 {
				t.Fatalf("unexpected endpoint results: %+v", result)
			}
		})
	}
}
