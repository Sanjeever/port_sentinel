package ports

import (
	"bytes"
	"fmt"
	"strconv"
	"strings"
)

// parseLsof 读取 lsof 的 NUL 字段协议，不依赖本地化表头或空格分列。
func parseLsof(data []byte) ([]Entry, error) {
	entries := []Entry{}
	var current Entry
	var pid int32
	var fd string
	flush := func() error {
		if current.Protocol != "TCP" && current.Protocol != "UDP" {
			return nil
		}
		if current.Local == "" {
			return fmt.Errorf("lsof: missing endpoint")
		}
		pos := strings.LastIndex(current.Local, ":")
		if pos < 0 {
			return fmt.Errorf("lsof: invalid endpoint %q", current.Local)
		}
		port := current.Local[pos+1:]
		if port == "*" {
			return nil
		} // 尚未绑定端口的套接字。
		n, err := strconv.ParseUint(port, 10, 16)
		if err != nil {
			return fmt.Errorf("lsof: %w", err)
		}
		if n == 0 {
			return nil
		}
		current.Port = uint32(n)
		current.Process.PID = pid
		current.ID = fd
		if current.Protocol == "UDP" {
			current.State = "BOUND"
		}
		entries = append(entries, current)
		return nil
	}
	for _, raw := range bytes.Split(data, []byte{0}) {
		field := strings.TrimLeft(string(raw), "\n")
		if field == "" {
			continue
		}
		value := field[1:]
		switch field[0] {
		case 'p':
			if err := flush(); err != nil {
				return nil, err
			}
			current = Entry{}
			n, err := strconv.ParseInt(value, 10, 32)
			if err != nil {
				return nil, err
			}
			pid = int32(n)
		case 'f':
			if err := flush(); err != nil {
				return nil, err
			}
			current = Entry{}
			fd = value
		case 'P':
			current.Protocol = value
		case 'n':
			parts := strings.SplitN(value, "->", 2)
			current.Local = parts[0]
			if len(parts) == 2 {
				current.Remote = &parts[1]
			}
		case 'T':
			if strings.HasPrefix(value, "ST=") {
				current.State = value[3:]
			}
		}
	}
	if err := flush(); err != nil {
		return nil, err
	}
	return entries, nil
}
