//go:build darwin || linux

package privilege

import "os"

func elevated() bool { return os.Geteuid() == 0 }
