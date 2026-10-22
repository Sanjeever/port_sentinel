package privilege

import (
	"context"
	"encoding/json"
	"net"
	"testing"
	"time"

	"github.com/Sanjeever/port_sentinel/internal/ports"
)

func TestRequestValidation(t *testing.T) {
	for _, r := range []Request{{Operation: "shell"}, {Operation: "scan", Force: true}, {Operation: "terminate", Targets: []ports.Identity{{PID: -1, Created: 1}}}, {Operation: "terminate", Targets: []ports.Identity{{PID: 55, Created: 1}}}} {
		if err := r.Validate(55); err == nil {
			t.Fatalf("accepted %+v", r)
		}
	}
	for _, args := range [][]string{{}, {"0.0.0.0:12", "token", "1", "2"}, {"127.0.0.1:12", "invalid", "23", "2"}} {
		if err := Serve(args); err == nil {
			t.Fatalf("accepted %v", args)
		}
	}
}
func TestIsolatedAuthenticatedChannel(t *testing.T) {
	start := func(ctx context.Context, _ string, args []string) error {
		wrong, err := net.Dial("tcp4", args[1])
		if err != nil {
			return err
		}
		json.NewEncoder(wrong).Encode("wrong-token")
		wrong.Close()
		conn, err := net.Dial("tcp4", args[1])
		if err != nil {
			return err
		}
		defer conn.Close()
		json.NewEncoder(conn).Encode(args[2])
		var r Request
		if err = json.NewDecoder(conn).Decode(&r); err != nil {
			return err
		}
		if r.Operation != "scan" {
			t.Errorf("changed request: %+v", r)
		}
		return json.NewEncoder(conn).Encode(Response{Snapshot: ports.Snapshot{Visibility: "authorized", Entries: []ports.Entry{}}})
	}
	response, err := run(context.Background(), Request{Operation: "scan"}, start)
	if err != nil || response.Snapshot.Visibility != "authorized" {
		t.Fatalf("%+v %v", response, err)
	}
}
func TestCancellationAndAuthorizationFailure(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Millisecond)
	defer cancel()
	_, err := run(ctx, Request{Operation: "scan"}, func(ctx context.Context, _ string, _ []string) error { <-ctx.Done(); return ctx.Err() })
	if err == nil {
		t.Fatal("cancellation hidden")
	}
	_, err = run(context.Background(), Request{Operation: "scan"}, func(context.Context, string, []string) error { return ports.Failure("authorization_cancelled", nil) })
	if f, ok := err.(*ports.Fault); !ok || f.Code != "authorization_cancelled" {
		t.Fatalf("%v", err)
	}
}
