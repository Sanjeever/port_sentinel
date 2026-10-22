package ports

import (
	"strings"
	"testing"
)

func TestProcRowsRetainEveryOwner(t *testing.T) {
	rows, err := parseProcNet(strings.NewReader("header\n 0: 0100007F:1F90 00000000:0000 0A 0 0 0 0 0 42\n"), true, map[string][]int32{"42": {20, 30}})
	if err != nil || len(rows) != 2 || rows[0].Local != "127.0.0.1:8080" || rows[1].Process.PID != 30 {
		t.Fatalf("%+v %v", rows, err)
	}
	value, port, err := procAddress("00000000000000000000000001000000:0035")
	if err != nil || value != "[::1]:53" || port != 53 {
		t.Fatalf("%s %d %v", value, port, err)
	}
	if _, err = parseProcNet(strings.NewReader("header\ninvalid\n"), true, nil); err == nil {
		t.Fatal("accepted malformed table")
	}
}
