package ports

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"
)

func connections(ctx context.Context) ([]Entry, error) {
	cmd := exec.CommandContext(ctx, "/usr/sbin/lsof", "-nP", "-iTCP", "-iUDP", "-F0pftPnT")
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	output, err := cmd.Output()
	if ctx.Err() != nil {
		return nil, ctx.Err()
	}
	if err != nil {
		if exit, ok := err.(*exec.ExitError); !ok || exit.ExitCode() != 1 || len(output) > 0 || stderr.Len() > 0 {
			return nil, fmt.Errorf("lsof: %w: %s", err, stderr.String())
		}
	}
	if stderr.Len() > 0 {
		return nil, fmt.Errorf("lsof: %s", stderr.String())
	}
	return parseLsof(output)
}
