package privilege

import (
	"context"
	"fmt"
	"os/exec"
	"strings"

	"github.com/Sanjeever/port_sentinel/internal/ports"
)

func shellQuote(s string) string { return "'" + strings.ReplaceAll(s, "'", "'\\''") + "'" }
func launch(ctx context.Context, exe string, args []string) error {
	parts := []string{shellQuote(exe)}
	for _, a := range args {
		parts = append(parts, shellQuote(a))
	}
	cmd := exec.CommandContext(ctx, "/usr/bin/osascript", "-e", "on run argv", "-e", "do shell script (item 1 of argv) with administrator privileges", "-e", "end run", strings.Join(parts, " "))
	output, err := cmd.CombinedOutput()
	if ctx.Err() != nil {
		return ports.Failure(ports.Classify(ctx.Err()), ctx.Err())
	}
	if err != nil {
		code := "authorization_failed"
		if strings.Contains(string(output), "(-128)") {
			code = "authorization_cancelled"
		}
		return ports.Failure(code, fmt.Errorf("%w: %s", err, output))
	}
	return nil
}
