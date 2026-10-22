package ports

import (
	"bufio"
	"context"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

func connections(ctx context.Context) ([]Entry, error) { return procConnections(ctx, "/proc") }
func procConnections(ctx context.Context, root string) ([]Entry, error) {
	owners := map[string][]int32{}
	dirs, err := os.ReadDir(root)
	if err != nil {
		return nil, err
	}
	for _, dir := range dirs {
		if err = ctx.Err(); err != nil {
			return nil, err
		}
		pid, e := strconv.ParseInt(dir.Name(), 10, 32)
		if e != nil || pid <= 0 {
			continue
		}
		fds, e := os.ReadDir(filepath.Join(root, dir.Name(), "fd"))
		if errors.Is(e, os.ErrPermission) || errors.Is(e, os.ErrNotExist) {
			continue
		}
		if e != nil {
			return nil, e
		}
		for _, fd := range fds {
			link, e := os.Readlink(filepath.Join(root, dir.Name(), "fd", fd.Name()))
			if errors.Is(e, os.ErrPermission) || errors.Is(e, os.ErrNotExist) {
				continue
			}
			if e != nil {
				return nil, e
			}
			if strings.HasPrefix(link, "socket:[") && strings.HasSuffix(link, "]") {
				inode := link[8 : len(link)-1]
				found := false
				for _, p := range owners[inode] {
					if p == int32(pid) {
						found = true
					}
				}
				if !found {
					owners[inode] = append(owners[inode], int32(pid))
				}
			}
		}
	}
	entries := []Entry{}
	for _, name := range []string{"tcp", "tcp6", "udp", "udp6"} {
		if err = ctx.Err(); err != nil {
			return nil, err
		}
		f, e := os.Open(filepath.Join(root, "net", name))
		if strings.HasSuffix(name, "6") && errors.Is(e, os.ErrNotExist) {
			continue
		}
		if e != nil {
			return nil, e
		}
		rows, e := parseProcNet(f, strings.HasPrefix(name, "tcp"), owners)
		closeErr := f.Close()
		if e != nil {
			return nil, e
		}
		if closeErr != nil {
			return nil, closeErr
		}
		entries = append(entries, rows...)
	}
	return entries, nil
}
func procAddress(value string) (string, uint32, error) {
	parts := strings.Split(value, ":")
	if len(parts) != 2 {
		return "", 0, fmt.Errorf("invalid proc endpoint %q", value)
	}
	data, err := hex.DecodeString(parts[0])
	if err != nil || len(data) != 4 && len(data) != 16 {
		return "", 0, fmt.Errorf("invalid proc address %q", value)
	}
	for n := 0; n < len(data); n += 4 {
		v := binary.LittleEndian.Uint32(data[n:])
		binary.BigEndian.PutUint32(data[n:], v)
	}
	port, err := strconv.ParseUint(parts[1], 16, 16)
	if err != nil {
		return "", 0, err
	}
	return net.JoinHostPort(net.IP(data).String(), strconv.Itoa(int(port))), uint32(port), nil
}
func parseProcNet(input io.Reader, tcp bool, owners map[string][]int32) ([]Entry, error) {
	s := bufio.NewScanner(input)
	if !s.Scan() {
		return nil, fmt.Errorf("missing proc net header")
	}
	entries := []Entry{}
	states := map[string]string{"01": "ESTABLISHED", "02": "SYN_SENT", "03": "SYN_RECEIVED", "04": "FIN_WAIT_1", "05": "FIN_WAIT_2", "06": "TIME_WAIT", "07": "CLOSED", "08": "CLOSE_WAIT", "09": "LAST_ACK", "0A": "LISTEN", "0B": "CLOSING", "0C": "NEW_SYN_RECV"}
	for s.Scan() {
		f := strings.Fields(s.Text())
		if len(f) < 10 {
			return nil, fmt.Errorf("invalid proc net row %q", s.Text())
		}
		local, port, err := procAddress(f[1])
		if err != nil {
			return nil, err
		}
		remote, rport, err := procAddress(f[2])
		if err != nil {
			return nil, err
		}
		if port == 0 {
			continue
		}
		e := Entry{Protocol: "UDP", Local: local, Port: port, State: "BOUND", ID: f[9]}
		if rport != 0 {
			e.Remote = &remote
		}
		if tcp {
			e.Protocol = "TCP"
			var ok bool
			e.State, ok = states[f[3]]
			if !ok {
				return nil, fmt.Errorf("invalid TCP state %q", f[3])
			}
		}
		pids := owners[f[9]]
		if len(pids) == 0 {
			pids = []int32{0}
		}
		for _, pid := range pids {
			e.Process.PID = pid
			entries = append(entries, e)
		}
	}
	return entries, s.Err()
}
