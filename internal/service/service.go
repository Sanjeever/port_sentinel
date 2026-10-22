package service

import (
	"context"
	"sync"
	"time"

	"github.com/Sanjeever/port_sentinel/internal/ports"
	"github.com/Sanjeever/port_sentinel/internal/privilege"
	"github.com/Sanjeever/port_sentinel/internal/settings"
)

type State struct {
	Entries       []ports.Entry        `json:"entries"`
	Visibility    string               `json:"visibility"`
	LastSuccess   *time.Time           `json:"lastSuccess"`
	Stale         bool                 `json:"stale"`
	Task          string               `json:"task"`
	Error         *ports.Fault         `json:"error"`
	SettingsError *ports.Fault         `json:"settingsError"`
	Preferences   settings.Preferences `json:"preferences"`
	Results       []ports.Result       `json:"results"`
}
type Service struct {
	mu          sync.Mutex
	saveMu      sync.Mutex
	state       State
	ctx         context.Context
	stop        context.CancelFunc
	cancel      context.CancelFunc
	wg          sync.WaitGroup
	store       *settings.Store
	Changed     func()
	Scan        func(context.Context, bool) (ports.Snapshot, error)
	Elevate     func(context.Context, privilege.Request) (privilege.Response, error)
	Operator    ports.Operator
	stopping    bool
	lastAttempt time.Time
}

func New(ctx context.Context, store *settings.Store, changed func()) *Service {
	ctx, stop := context.WithCancel(ctx)
	p, err := store.Load()
	s := &Service{ctx: ctx, stop: stop, store: store, Changed: changed, Scan: ports.Scan, Elevate: privilege.Run, Operator: ports.NewOperator(), state: State{Entries: []ports.Entry{}, Results: []ports.Result{}, Preferences: p}}
	if err != nil {
		s.state.SettingsError = ports.Failure("settings_load", err)
	}
	return s
}
func (s *Service) State() State {
	s.mu.Lock()
	defer s.mu.Unlock()
	v := s.state
	v.Entries = append([]ports.Entry{}, v.Entries...)
	v.Results = append([]ports.Result{}, v.Results...)
	return v
}
func (s *Service) Context() context.Context { return s.ctx }
func (s *Service) emit() {
	if s.Changed != nil {
		s.Changed()
	}
}
func (s *Service) Start() {
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		s.Refresh(false)
		ticker := time.NewTicker(time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-s.ctx.Done():
				return
			case <-ticker.C:
				v := s.State()
				s.mu.Lock()
				due := time.Since(s.lastAttempt) >= time.Duration(v.Preferences.Interval)*time.Second
				s.mu.Unlock()
				if v.Preferences.AutoRefresh && due {
					s.refresh(false, false)
				}
			}
		}
	}()
}
func (s *Service) begin(task string, clearError bool) (context.Context, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.stopping || s.state.Task != "" {
		return nil, false
	}
	ctx, cancel := context.WithTimeout(s.ctx, 2*time.Minute)
	s.cancel = cancel
	s.state.Task = task
	if clearError {
		s.state.Error = nil
	}
	s.lastAttempt = time.Now()
	s.wg.Add(1)
	return ctx, true
}
func (s *Service) finish() {
	s.mu.Lock()
	s.cancel()
	s.cancel = nil
	s.state.Task = ""
	s.mu.Unlock()
	s.emit()
	s.wg.Done()
}
func (s *Service) Refresh(authorized bool) bool {
	return s.refresh(authorized, true)
}
func (s *Service) refresh(authorized, clearError bool) bool {
	ctx, ok := s.begin("scanning", clearError)
	if !ok {
		return false
	}
	s.emit()
	go func() {
		defer s.finish()
		var snapshot ports.Snapshot
		var err error
		if authorized {
			var r privilege.Response
			r, err = s.Elevate(ctx, privilege.Request{Operation: "scan"})
			snapshot = r.Snapshot
		} else {
			snapshot, err = s.Scan(ctx, false)
		}
		if ctx.Err() != nil {
			err = ctx.Err()
		}
		s.mu.Lock()
		defer s.mu.Unlock()
		if err != nil {
			s.state.Error = fault(err)
			s.state.Stale = s.state.LastSuccess != nil
			return
		}
		s.state.Entries = snapshot.Entries
		s.state.Visibility = snapshot.Visibility
		now := time.Now()
		s.state.LastSuccess = &now
		s.state.Stale = false
		if s.state.Error != nil {
			switch s.state.Error.Code {
			case "authorization_cancelled", "authorization_failed", "authorization_unavailable", "cancelled":
			default:
				s.state.Error = nil
			}
		}
	}()
	return true
}
func fault(err error) *ports.Fault {
	if f, ok := err.(*ports.Fault); ok {
		return f
	}
	return ports.Failure(ports.Classify(err), err)
}
func (s *Service) Terminate(targets []ports.Identity, force bool) bool {
	ctx, ok := s.begin("terminating", true)
	if !ok {
		return false
	}
	s.mu.Lock()
	valid := map[string]bool{}
	for _, e := range s.state.Entries {
		valid[e.Process.Key()] = true
	}
	s.mu.Unlock()
	for _, t := range targets {
		if !valid[t.Key()] {
			s.mu.Lock()
			s.state.Error = ports.Failure("identity_changed", nil)
			s.mu.Unlock()
			s.finish()
			return true
		}
	}
	s.emit()
	go func() {
		defer s.finish()
		results := s.Operator.Execute(ctx, targets, force)
		pending := []ports.Identity{}
		for _, r := range results {
			if r.Status == "permission_denied" {
				pending = append(pending, r.Target)
			}
		}
		if len(pending) > 0 && ctx.Err() == nil {
			response, err := s.Elevate(ctx, privilege.Request{Operation: "terminate", Targets: pending, Force: force})
			for n := range results {
				if results[n].Status != "permission_denied" {
					continue
				}
				if err != nil {
					results[n].Status = fault(err).Code
					results[n].Detail = err.Error()
					continue
				}
				for _, r := range response.Results {
					if r.Target.Key() == results[n].Target.Key() {
						results[n] = r
					}
				}
			}
		}
		snapshot, err := s.Scan(ctx, false)
		s.mu.Lock()
		defer s.mu.Unlock()
		s.state.Results = results
		if err != nil {
			s.state.Error = fault(err)
			s.state.Stale = s.state.LastSuccess != nil
		} else {
			s.state.Entries = snapshot.Entries
			s.state.Visibility = snapshot.Visibility
			now := time.Now()
			s.state.LastSuccess = &now
			s.state.Stale = false
		}
	}()
	return true
}
func (s *Service) Save(p settings.Preferences) error {
	s.saveMu.Lock()
	defer s.saveMu.Unlock()
	return s.save(p)
}
func (s *Service) SaveWindow(width, height int) error {
	s.saveMu.Lock()
	defer s.saveMu.Unlock()
	p := s.State().Preferences
	if width == p.Width && height == p.Height {
		return nil
	}
	p.Width = width
	p.Height = height
	return s.save(p)
}
func (s *Service) save(p settings.Preferences) error {
	if err := s.store.Save(p); err != nil {
		s.mu.Lock()
		s.state.SettingsError = ports.Failure("settings_save", err)
		s.mu.Unlock()
		s.emit()
		return err
	}
	s.mu.Lock()
	s.state.Preferences = p
	s.state.SettingsError = nil
	s.mu.Unlock()
	s.emit()
	return nil
}
func (s *Service) Cancel() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.cancel != nil {
		s.cancel()
	}
}
func (s *Service) Stop() { s.mu.Lock(); s.stopping = true; s.stop(); s.mu.Unlock(); s.wg.Wait() }
