package privilege

import (
	"context"
	"fmt"
	"os/exec"

	"github.com/Sanjeever/port_sentinel/internal/ports"
)

func launch(ctx context.Context, exe string, args []string) error {
	pkexec, err := exec.LookPath("pkexec")
	if err != nil {
		return ports.Failure("authorization_unavailable", err)
	}
	cmd := exec.CommandContext(ctx, pkexec, append([]string{"--disable-internal-agent", exe}, args...)...)
	output, err := cmd.CombinedOutput()
	if ctx.Err() != nil {
		return ports.Failure(ports.Classify(ctx.Err()), ctx.Err())
	}
	if err != nil {
		code := "authorization_failed"
		if e, ok := err.(*exec.ExitError); ok {
			if e.ExitCode() == 126 {
				code = "authorization_cancelled"
			}
			if e.ExitCode() == 127 {
				code = "authorization_unavailable"
			}
		}
		return ports.Failure(code, fmt.Errorf("%w: %s", err, output))
	}
	return nil
}
