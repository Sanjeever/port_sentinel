package service

import (
	"context"
	"errors"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Sanjeever/port_sentinel/internal/ports"
	"github.com/Sanjeever/port_sentinel/internal/privilege"
	"github.com/Sanjeever/port_sentinel/internal/settings"
)

func settled(t *testing.T, s *Service) {
	t.Helper()
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		if s.State().Task == "" {
			return
		}
		time.Sleep(time.Millisecond)
	}
	t.Fatal("task did not finish")
}

func TestBatchOnlyElevatesDeniedTargetsAndRescans(t *testing.T) {
	s := New(context.Background(), &settings.Store{Path: filepath.Join(t.TempDir(), "settings.json")}, nil)
	defer s.Stop()
	a, b := ports.Identity{PID: 20, Created: 100}, ports.Identity{PID: 21, Created: 101}
	s.state.Entries = []ports.Entry{{Process: a}, {Process: b}}
	var exited atomic.Bool
	s.Operator = ports.Operator{Self: 99, Wait: 100 * time.Millisecond, Inspect: func(_ context.Context, pid int32) ports.Identity {
		if pid == 21 {
			if exited.Load() {
				return ports.Identity{Status: "exited"}
			}
			return b
		}
		return a
	}, Signal: func(_ context.Context, p ports.Identity, force bool) error {
		if force {
			t.Error("force was not confirmed")
		}
		if p.PID == 20 {
			return ports.Failure("permission_denied", nil)
		}
		exited.Store(true)
		return nil
	}}
	calls := 0
	s.Elevate = func(_ context.Context, r privilege.Request) (privilege.Response, error) {
		calls++
		if len(r.Targets) != 1 || r.Targets[0].PID != 20 || r.Force {
			t.Errorf("wrong authorization scope: %+v", r)
		}
		return privilege.Response{Results: []ports.Result{{Target: a, Status: "protected"}}}, nil
	}
	s.Scan = func(context.Context, bool) (ports.Snapshot, error) {
		return ports.Snapshot{Entries: []ports.Entry{{Port: 8000, Process: a}}, Visibility: "ordinary"}, nil
	}
	if !s.Terminate([]ports.Identity{a, a, b}, false) || s.Refresh(false) {
		t.Fatal("operation overlap")
	}
	settled(t, s)
	v := s.State()
	if calls != 1 || len(v.Results) != 2 || v.Results[0].Status != "protected" || v.Results[1].Status != "exited" || len(v.Entries) != 1 || v.Entries[0].Port != 8000 {
		t.Fatalf("%d %+v", calls, v)
	}
}
func TestAuthorizationCancellationAndOrdinaryScope(t *testing.T) {
	s := New(context.Background(), &settings.Store{Path: filepath.Join(t.TempDir(), "settings.json")}, nil)
	defer s.Stop()
	s.Elevate = func(context.Context, privilege.Request) (privilege.Response, error) {
		return privilege.Response{Snapshot: ports.Snapshot{Entries: []ports.Entry{{Port: 80}}, Visibility: "authorized"}}, nil
	}
	s.Refresh(true)
	settled(t, s)
	if s.State().Visibility != "authorized" {
		t.Fatal("lost scan scope")
	}
	s.Scan = func(context.Context, bool) (ports.Snapshot, error) {
		return ports.Snapshot{Entries: []ports.Entry{{Port: 80}}, Visibility: "ordinary"}, nil
	}
	s.Refresh(false)
	settled(t, s)
	if s.State().Visibility != "ordinary" {
		t.Fatal("ordinary scan kept authorized label")
	}
	s.Elevate = func(context.Context, privilege.Request) (privilege.Response, error) {
		return privilege.Response{}, ports.Failure("authorization_cancelled", nil)
	}
	s.Refresh(true)
	settled(t, s)
	v := s.State()
	if len(v.Entries) != 1 || v.Error == nil || v.Error.Code != "authorization_cancelled" {
		t.Fatalf("%+v", v)
	}
	s.refresh(false, false)
	settled(t, s)
	if v = s.State(); v.Error == nil || v.Error.Code != "authorization_cancelled" || v.Stale {
		t.Fatalf("automatic refresh hid cancellation: %+v", v)
	}
}
func TestScanSerializationAndFailureRetainsData(t *testing.T) {
	s := New(context.Background(), &settings.Store{Path: filepath.Join(t.TempDir(), "settings.json")}, nil)
	defer s.Stop()
	release := make(chan struct{})
	var calls atomic.Int32
	s.Scan = func(ctx context.Context, _ bool) (ports.Snapshot, error) {
		calls.Add(1)
		select {
		case <-release:
			return ports.Snapshot{Entries: []ports.Entry{{Port: 80}}, Visibility: "ordinary"}, nil
		case <-ctx.Done():
			return ports.Snapshot{}, ctx.Err()
		}
	}
	if !s.Refresh(false) || s.Refresh(false) {
		t.Fatal("overlapping scan accepted")
	}
	close(release)
	settled(t, s)
	s.Scan = func(context.Context, bool) (ports.Snapshot, error) {
		return ports.Snapshot{}, errors.New("real failure")
	}
	s.Refresh(false)
	settled(t, s)
	v := s.State()
	if len(v.Entries) != 1 || !v.Stale || v.Error == nil || v.LastSuccess == nil {
		t.Fatalf("lost last data: %+v", v)
	}
	if calls.Load() != 1 {
		t.Fatal("unexpected scan count")
	}
}
func TestStopCancelsWorkerAndPreventsNewTasks(t *testing.T) {
	s := New(context.Background(), &settings.Store{Path: filepath.Join(t.TempDir(), "settings.json")}, nil)
	s.Scan = func(ctx context.Context, _ bool) (ports.Snapshot, error) {
		<-ctx.Done()
		return ports.Snapshot{}, ctx.Err()
	}
	s.Refresh(false)
	s.Stop()
	if s.Refresh(false) {
		t.Fatal("accepted task after shutdown")
	}
}
