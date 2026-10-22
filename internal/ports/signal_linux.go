package ports

import (
	"context"
	"golang.org/x/sys/unix"
)

func signal(ctx context.Context, t Identity, force bool) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	fd, err := unix.PidfdOpen(int(t.PID), 0)
	if err != nil {
		return err
	}
	defer unix.Close(fd)
	actual := Inspect(ctx, t.PID)
	if actual.Created == 0 {
		return Failure(actual.Status, nil)
	}
	if actual.Created != t.Created {
		return Failure("identity_changed", nil)
	}
	s := unix.SIGTERM
	if force {
		s = unix.SIGKILL
	}
	return unix.PidfdSendSignal(fd, s, nil, 0)
}
