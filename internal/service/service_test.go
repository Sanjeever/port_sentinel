package service

import (
	"context"
	"errors"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Sanjeever/port_sentinel/internal/ports"
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
