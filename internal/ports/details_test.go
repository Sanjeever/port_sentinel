package ports

import (
	"context"
	"testing"
)

func TestTraceParentsKeepsVerifiedPrefix(t *testing.T) {
	child := ProcessSummary{PID: 3, Created: 300}
	parent := parentLink{process: ProcessSummary{PID: 2, Created: 200}, parent: 1}
	for _, tt := range []struct {
		name string
		root parentLink
		fail *Fault
		want string
	}{
		{name: "reused parent", root: parentLink{process: ProcessSummary{PID: 1, Created: 400}}, want: "parent_identity_changed"},
		{name: "unreadable parent", fail: Failure("permission_denied", nil), want: "permission_denied"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			parents, fault := traceParents(context.Background(), child, 2, func(_ context.Context, pid int32) (parentLink, *Fault) {
				if pid == 2 {
					return parent, nil
				}
				return tt.root, tt.fail
			})
			if fault == nil || fault.Code != tt.want || len(parents) != 1 || parents[0] != parent.process {
				t.Fatalf("parents %+v, fault %v", parents, fault)
			}
		})
	}
}
