//go:build !windows

package settings

import "os"

func replace(source, target string) error { return os.Rename(source, target) }
