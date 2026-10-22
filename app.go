package main

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/Sanjeever/port_sentinel/internal/ports"
	"github.com/Sanjeever/port_sentinel/internal/service"
	"github.com/Sanjeever/port_sentinel/internal/settings"
	"github.com/Sanjeever/port_sentinel/internal/update"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx                context.Context
	cancel             context.CancelFunc
	service            *service.Service
	updater            *update.Manager
	updateFailure      string
	mu                 sync.Mutex
	sequence           uint64
	wg                 sync.WaitGroup
	cleanupStage       string
	cleanupPID         int
	closeBlocked       bool
	closeWithoutSaving bool
}
type View struct {
	Entries       []ports.Entry        `json:"entries"`
	Visibility    string               `json:"visibility"`
	LastSuccess   *time.Time           `json:"lastSuccess" ts_type:"string | null"`
	Stale         bool                 `json:"stale"`
	Task          string               `json:"task"`
	Error         *ports.Fault         `json:"error"`
	SettingsError *ports.Fault         `json:"settingsError"`
	Preferences   settings.Preferences `json:"preferences"`
	Results       []ports.Result       `json:"results"`
	Build         BuildInfo            `json:"build"`
	Update        update.State         `json:"update"`
	Sequence      uint64               `json:"sequence"`
	CloseBlocked  bool                 `json:"closeBlocked"`
}

func NewApp() (*App, error) {
	store, err := settings.UserStore()
	if err != nil {
		return nil, err
	}
	if dir := os.Getenv("PORT_SENTINEL_CONFIG_DIR"); currentBuild().Development && dir != "" {
		store = &settings.Store{Path: filepath.Join(dir, "settings.json")}
	}
	ctx, cancel := context.WithCancel(context.Background())
	a := &App{ctx: ctx, cancel: cancel}
	a.service = service.New(ctx, store, nil)
	a.updater = update.New(currentBuild().Version, nil)
	return a, nil
}
func (a *App) startup(ctx context.Context) { a.ctx = ctx }
func (a *App) ready(ctx context.Context) {
	if a.cleanupStage != "" {
		if err := update.Confirm(a.cleanupStage); err != nil {
			a.updateFailure = err.Error()
		} else {
			a.wg.Add(1)
			go func() {
				defer a.wg.Done()
				if err := update.Cleanup(a.cleanupStage, a.cleanupPID); err != nil {
					a.mu.Lock()
					a.updateFailure = err.Error()
					a.mu.Unlock()
					a.emit()
				}
			}()
		}
	}
	if screens, err := runtime.ScreenGetAll(ctx); err == nil {
		for _, screen := range screens {
			if screen.IsCurrent || screen.IsPrimary {
				p := a.service.State().Preferences
				w, h := min(p.Width, screen.Size.Width-40), min(p.Height, screen.Size.Height-80)
				runtime.WindowSetSize(ctx, max(680, w), max(480, h))
				break
			}
		}
	}
	a.service.Changed = a.emit
	a.updater.SetChanged(a.emit)
	a.service.Start()
	a.wg.Add(1)
	go func() {
		defer a.wg.Done()
		timer := time.NewTimer(30 * time.Second)
		defer timer.Stop()
		for {
			select {
			case <-a.serviceContext().Done():
				return
			case <-timer.C:
				if !currentBuild().Development && a.service.State().Preferences.AutoUpdate {
					a.updater.Check(a.serviceContext())
				}
				timer.Reset(6 * time.Hour)
			}
		}
	}()
}
func (a *App) serviceContext() context.Context { return a.service.Context() }
func (a *App) emit()                           { runtime.EventsEmit(a.ctx, "sentinel:state", a.GetState()) }
func (a *App) GetState() View {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.sequence++
	u := a.updater.State()
	if a.updateFailure != "" {
		u.Error = a.updateFailure
		u.ErrorCode = "update_failed"
	}
	s := a.service.State()
	return View{Entries: s.Entries, Visibility: s.Visibility, LastSuccess: s.LastSuccess, Stale: s.Stale, Task: s.Task, Error: s.Error, SettingsError: s.SettingsError, Preferences: s.Preferences, Results: s.Results, Build: currentBuild(), Update: u, Sequence: a.sequence, CloseBlocked: a.closeBlocked}
}
func (a *App) Refresh(authorized bool) bool { return a.service.Refresh(authorized) }
func (a *App) CancelTask()                  { a.service.Cancel() }
func (a *App) Terminate(targets []ports.Identity, force bool) bool {
	return a.service.Terminate(targets, force)
}
func (a *App) SavePreferences(p settings.Preferences) error { return a.service.Save(p) }
func (a *App) SaveWindow() error {
	if !runtime.WindowIsNormal(a.ctx) {
		return nil
	}
	w, h := runtime.WindowGetSize(a.ctx)
	if w < 680 || h < 480 {
		return nil
	}
	return a.service.SaveWindow(w, h)
}
func (a *App) beforeClose(ctx context.Context) bool {
	a.mu.Lock()
	force := a.closeWithoutSaving
	a.mu.Unlock()
	if force {
		return false
	}
	if err := a.SaveWindow(); err != nil {
		a.mu.Lock()
		a.closeBlocked = true
		a.mu.Unlock()
		a.emit()
		return true
	}
	return false
}
func (a *App) ExitWithoutSaving() {
	a.mu.Lock()
	a.closeWithoutSaving = true
	a.mu.Unlock()
	runtime.Quit(a.ctx)
}
func (a *App) Copy(value string) error {
	if len(value) > 1<<20 {
		return fmt.Errorf("invalid_clipboard")
	}
	return runtime.ClipboardSetText(a.ctx, value)
}
func (a *App) OpenURL(value string) error {
	u, err := url.Parse(value)
	if err != nil || u.Scheme != "https" || u.Host != "github.com" || u.User != nil || u.Port() != "" {
		return fmt.Errorf("invalid_url")
	}
	if u.Path != "/Sanjeever/port_sentinel" && u.Path != "/Sanjeever/port_sentinel/releases" && u.Path != "/Sanjeever/port_sentinel/releases/latest" && !update.TrustedReleasePage(value) {
		return fmt.Errorf("invalid_url")
	}
	runtime.BrowserOpenURL(a.ctx, value)
	return nil
}
func (a *App) CheckUpdate() error {
	if currentBuild().Development {
		return fmt.Errorf("development_build")
	}
	return a.updater.Check(a.serviceContext())
}
func (a *App) InstallUpdate() error {
	if currentBuild().Development {
		return fmt.Errorf("development_build")
	}
	go func() {
		if err := a.updater.Start(a.serviceContext(), a.SaveWindow, func() { runtime.Quit(a.ctx) }); err != nil {
			fmt.Println(err)
		}
	}()
	return nil
}
func (a *App) CancelUpdate() { a.updater.Cancel() }
func (a *App) shutdown(ctx context.Context) {
	a.service.Stop()
	a.cancel()
	a.updater.Stop()
	a.wg.Wait()
	if err := a.updater.ReleaseParent(); err != nil {
		fmt.Println(err)
	}
}
