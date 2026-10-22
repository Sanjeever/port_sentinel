package ports

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strconv"
	"syscall"

	"github.com/shirou/gopsutil/v4/process"
)

type Fault struct {
	Code   string `json:"code"`
	Detail string `json:"detail"`
}

func (e *Fault) Error() string { return e.Code + ": " + e.Detail }
func Failure(code string, err error) *Fault {
	d := ""
	if err != nil {
		d = err.Error()
	}
	return &Fault{code, d}
}
func Classify(err error) string {
	if errors.Is(err, context.Canceled) {
		return "cancelled"
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return "timeout"
	}
	if errors.Is(err, os.ErrPermission) || errors.Is(err, syscall.EPERM) {
		return "permission_denied"
	}
	if errors.Is(err, process.ErrorProcessNotRunning) || errors.Is(err, syscall.ESRCH) || errors.Is(err, os.ErrNotExist) {
		return "exited"
	}
	return "system_error"
}

type Identity struct {
	PID        int32  `json:"pid"`
	Created    int64  `json:"created"`
	Name       string `json:"name"`
	Path       string `json:"path"`
	Status     string `json:"status"`
	PathStatus string `json:"pathStatus"`
	Risk       bool   `json:"risk"`
}

func (i Identity) Key() string { return fmt.Sprintf("%d:%d", i.PID, i.Created) }

type Entry struct {
	ID       string   `json:"id"`
	Protocol string   `json:"protocol"`
	Port     uint32   `json:"port"`
	Local    string   `json:"local"`
	Remote   *string  `json:"remote"`
	State    string   `json:"state"`
	Process  Identity `json:"process"`
}

func (e *Entry) Identify(socket string) {
	remote := ""
	if e.Remote != nil {
		remote = *e.Remote
	}
	e.ID = e.Process.Key() + "|" + e.Protocol + "|" + e.Local + "|" + remote + "|" + socket
}

type Snapshot struct {
	Entries    []Entry `json:"entries"`
	Visibility string  `json:"visibility"`
}

func Inspect(ctx context.Context, pid int32) Identity {
	i := Identity{PID: pid, Status: "available", PathStatus: "available", Risk: pid <= 4}
	if pid <= 0 {
		i.Status = "no_pid"
		i.PathStatus = "no_pid"
		return i
	}
	p, err := process.NewProcessWithContext(ctx, pid)
	if err == nil {
		i.Created, err = p.CreateTimeWithContext(ctx)
	}
	if err != nil {
		i.Status = Classify(err)
		i.PathStatus = i.Status
		return i
	}
	i.Name, err = p.NameWithContext(ctx)
	if err != nil {
		i.Status = Classify(err)
	}
	i.Path, err = p.ExeWithContext(ctx)
	if err != nil {
		i.PathStatus = Classify(err)
	}
	i.Risk = i.Risk || criticalName(i.Name)
	return i
}
func criticalName(name string) bool {
	switch name {
	case "launchd", "kernel_task", "systemd", "init", "System", "Registry", "smss.exe", "csrss.exe", "wininit.exe", "services.exe", "lsass.exe", "winlogon.exe":
		return true
	}
	return false
}
func ValidateTargets(targets []Identity, self int32) error {
	if len(targets) == 0 || len(targets) > 1024 {
		return fmt.Errorf("invalid_targets")
	}
	for _, t := range targets {
		if t.PID <= 1 || t.PID == self || t.Created <= 0 {
			return fmt.Errorf("unsafe_target: " + strconv.Itoa(int(t.PID)))
		}
	}
	return nil
}
