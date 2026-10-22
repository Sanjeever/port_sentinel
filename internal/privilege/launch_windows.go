package privilege

import (
	"context"
	"strings"
	"syscall"
	"unsafe"

	"github.com/Sanjeever/port_sentinel/internal/ports"
	"golang.org/x/sys/windows"
)

type shellExecuteInfo struct {
	Size       uint32
	Mask       uint32
	Window     windows.Handle
	Verb       *uint16
	File       *uint16
	Parameters *uint16
	Directory  *uint16
	Show       int32
	Instance   windows.Handle
	IDList     uintptr
	Class      *uint16
	ClassKey   windows.Handle
	HotKey     uint32
	Icon       windows.Handle
	Process    windows.Handle
}

func launch(ctx context.Context, exe string, args []string) error {
	quoted := make([]string, len(args))
	for n, a := range args {
		quoted[n] = syscall.EscapeArg(a)
	}
	verb, _ := windows.UTF16PtrFromString("runas")
	file, err := windows.UTF16PtrFromString(exe)
	if err != nil {
		return err
	}
	params, _ := windows.UTF16PtrFromString(strings.Join(quoted, " "))
	i := shellExecuteInfo{Mask: 0x40 | 0x100, Verb: verb, File: file, Parameters: params, Show: 0}
	i.Size = uint32(unsafe.Sizeof(i))
	ok, _, err := windows.NewLazySystemDLL("shell32.dll").NewProc("ShellExecuteExW").Call(uintptr(unsafe.Pointer(&i)))
	if ok == 0 {
		code := "authorization_failed"
		if err == windows.ERROR_CANCELLED {
			code = "authorization_cancelled"
		}
		return ports.Failure(code, err)
	}
	defer windows.CloseHandle(i.Process)
	for {
		if err = ctx.Err(); err != nil {
			return ports.Failure(ports.Classify(err), err)
		}
		result, e := windows.WaitForSingleObject(i.Process, 100)
		if e != nil {
			return e
		}
		if result == windows.WAIT_OBJECT_0 {
			var code uint32
			if e = windows.GetExitCodeProcess(i.Process, &code); e != nil {
				return e
			}
			if code != 0 {
				return ports.Failure("helper_failed", syscall.Errno(code))
			}
			return nil
		}
	}
}
