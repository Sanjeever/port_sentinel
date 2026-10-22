package ports

import (
	"context"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

var user32 = windows.NewLazySystemDLL("user32.dll")

func signal(ctx context.Context, t Identity, force bool) error {
	access := uint32(windows.PROCESS_QUERY_LIMITED_INFORMATION | windows.SYNCHRONIZE)
	if force {
		access |= windows.PROCESS_TERMINATE
	}
	h, err := windows.OpenProcess(access, false, uint32(t.PID))
	if err != nil {
		return err
	}
	defer windows.CloseHandle(h)
	var created, exit, kernel, user windows.Filetime
	if err = windows.GetProcessTimes(h, &created, &exit, &kernel, &user); err != nil {
		return err
	}
	if created.Nanoseconds()/1e6 != t.Created {
		return Failure("identity_changed", nil)
	}
	if err = ctx.Err(); err != nil {
		return err
	}
	if force {
		return windows.TerminateProcess(h, 1)
	}
	getPID := user32.NewProc("GetWindowThreadProcessId")
	post := user32.NewProc("PostMessageW")
	count := 0
	var postErr error
	callback := syscall.NewCallback(func(hwnd, unused uintptr) uintptr {
		var pid uint32
		getPID.Call(hwnd, uintptr(unsafe.Pointer(&pid)))
		if pid == uint32(t.PID) {
			ok, _, e := post.Call(hwnd, 0x0010, 0, 0)
			if ok == 0 {
				postErr = e
			} else {
				count++
			}
		}
		return 1
	})
	ok, _, err := user32.NewProc("EnumWindows").Call(callback, 0)
	if ok == 0 {
		return err
	}
	if postErr != nil {
		return postErr
	}
	if count == 0 {
		return Failure("graceful_unsupported", nil)
	}
	return nil
}
