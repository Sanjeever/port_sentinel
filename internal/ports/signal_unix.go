//go:build darwin

package ports

import (
	"context"
	"syscall"
)

func signal(ctx context.Context, t Identity, force bool) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	actual := Inspect(ctx, t.PID)
	if actual.Created == 0 {
		return Failure(actual.Status, nil)
	}
	if actual.Created != t.Created {
		return Failure("identity_changed", nil)
	}
	s := syscall.SIGTERM
	if force {
		s = syscall.SIGKILL
	}
	return syscall.Kill(int(t.PID), s)
}
