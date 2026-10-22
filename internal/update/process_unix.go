//go:build !windows

package update

import (
	"errors"
	"fmt"
	"os/exec"
	"syscall"
	"time"
)

func hideProcess(cmd *exec.Cmd) {}
func waitParent(pid int) error {
	deadline := time.Now().Add(time.Minute)
	for time.Now().Before(deadline) {
		err := syscall.Kill(pid, 0)
		if errors.Is(err, syscall.ESRCH) {
			return nil
		}
		if err != nil {
			return err
		}
		time.Sleep(100 * time.Millisecond)
	}
	return fmt.Errorf("等待旧程序退出超时")
}
