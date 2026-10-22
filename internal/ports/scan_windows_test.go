package ports

import (
	"bytes"
	"encoding/binary"
	"testing"
)

func TestWindowsIPv4TCPTable(t *testing.T) {
	var table bytes.Buffer
	for _, value := range []any{uint32(2), uint32(2), [4]byte{127, 0, 0, 1}, uint32(0x901f), [4]byte{}, uint32(0), uint32(20), uint32(5), [4]byte{127, 0, 0, 1}, uint32(0x901f), [4]byte{10, 0, 0, 2}, uint32(0xbb01), uint32(30)} {
		if err := binary.Write(&table, binary.LittleEndian, value); err != nil {
			t.Fatal(err)
		}
	}
	rows, err := parseWindowsTable(table.Bytes(), true, false)
	if err != nil || len(rows) != 2 {
		t.Fatalf("%+v %v", rows, err)
	}
	if rows[0].Port != 8080 || rows[0].State != "LISTEN" || rows[0].Remote != nil || rows[1].Remote == nil || *rows[1].Remote != "10.0.0.2:443" || rows[1].Process.PID != 30 {
		t.Fatalf("%+v", rows)
	}
	if _, err := parseWindowsTable(table.Bytes()[:10], true, false); err == nil {
		t.Fatal("accepted truncated table")
	}
}
func TestWindowsIPv6UDPTable(t *testing.T) {
	var table bytes.Buffer
	var address [16]byte
	address[15] = 1
	for _, value := range []any{uint32(1), address, uint32(3), uint32(0x3500), uint32(22)} {
		if err := binary.Write(&table, binary.LittleEndian, value); err != nil {
			t.Fatal(err)
		}
	}
	rows, err := parseWindowsTable(table.Bytes(), false, true)
	if err != nil || len(rows) != 1 || rows[0].Local != "[::1%3]:53" || rows[0].Protocol != "UDP" || rows[0].Remote != nil {
		t.Fatalf("%+v %v", rows, err)
	}
}
