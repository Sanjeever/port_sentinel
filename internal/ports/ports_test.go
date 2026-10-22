package ports

import (
	"bufio"
	"context"
	"encoding/json"
	"net"
	"os"
	"os/exec"
	ossignal "os/signal"
	"runtime"
	"syscall"
	"testing"
	"time"
)

func TestLsofIPv4IPv6UDPAndDuplicatePorts(t *testing.T) {
	data := []byte("p20\x00\nf4\x00PTCP\x00n127.0.0.1:8080\x00TST=LISTEN\x00\nf5\x00PTCP\x00n[::1]:8080->[::1]:9000\x00TST=ESTABLISHED\x00\nf6\x00PUDP\x00n*:5353\x00\nf7\x00PUDP\x00n*:*\x00\np30\x00\nf8\x00PTCP\x00n127.0.0.1:8080\x00TST=LISTEN\x00\n")
	rows, err := parseLsof(data)
	if err != nil {
		t.Fatal(err)
	}
	if len(rows) != 4 || rows[1].Remote == nil || rows[2].State != "BOUND" || rows[2].Remote != nil || rows[3].Process.PID != 30 {
		t.Fatalf("bad rows: %+v", rows)
	}
	for _, data := range []string{"p1\x00f2\x00PTCP\x00nwrong\x00", "p1\x00f2\x00PTCP\x00n*:NaN\x00"} {
		if _, err := parseLsof([]byte(data)); err == nil {
			t.Fatal("accepted malformed endpoint")
		}
	}
}
func TestOperatorIdentityDeduplicationAndPartialResults(t *testing.T) {
	called := 0
	op := Operator{Self: 99, Wait: time.Millisecond, Inspect: func(_ context.Context, pid int32) Identity {
		if pid == 4 {
			return Identity{Status: "exited"}
		}
		return Identity{PID: pid, Created: 20}
	}, Signal: func(_ context.Context, _ Identity, force bool) error {
		called++
		if force {
			t.Fatal("forced graceful request")
		}
		return Failure("permission_denied", nil)
	}}
	targets := []Identity{{PID: 2, Created: 20}, {PID: 2, Created: 20}, {PID: 3, Created: 10}, {PID: 4, Created: 20}, {PID: -1, Created: 20}, {PID: 99, Created: 20}}
	r := op.Execute(context.Background(), targets, false)
	want := []string{"permission_denied", "identity_changed", "exited", "unsafe_target", "unsafe_target"}
	if len(r) != len(want) {
		t.Fatalf("%+v", r)
	}
	for i, w := range want {
		if r[i].Status != w {
			t.Fatalf("%d: %+v", i, r)
		}
	}
	if called != 1 {
		t.Fatal("incorrect execution count", called)
	}
}

func TestOwnedWorker(t *testing.T) {
	if os.Getenv("PORT_SENTINEL_TEST_WORKER") != "1" {
		return
	}
	listener, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		os.Exit(2)
	}
	defer listener.Close()
	udp, err := net.ListenPacket("udp4", "127.0.0.1:0")
	if err != nil {
		os.Exit(3)
	}
	defer udp.Close()
	json.NewEncoder(os.Stdout).Encode([]int{listener.Addr().(*net.TCPAddr).Port, udp.LocalAddr().(*net.UDPAddr).Port})
	if runtime.GOOS != "windows" {
		ch := make(chan os.Signal, 1)
		ossignal.Notify(ch, syscall.SIGTERM)
		if os.Getenv("PORT_SENTINEL_IGNORE_TERM") == "1" {
			for {
				<-ch
			}
		}
		<-ch
		os.Exit(0)
	}
	select {}
}
func startWorker(t *testing.T, ignore bool) (*exec.Cmd, []int, <-chan error) {
	t.Helper()
	cmd := exec.Command(os.Args[0], "-test.run=^TestOwnedWorker$")
	cmd.Env = append(os.Environ(), "PORT_SENTINEL_TEST_WORKER=1")
	if ignore {
		cmd.Env = append(cmd.Env, "PORT_SENTINEL_IGNORE_TERM=1")
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		t.Fatal(err)
	}
	if err = cmd.Start(); err != nil {
		t.Fatal(err)
	}
	done := make(chan error, 1)
	go func() { done <- cmd.Wait() }()
	t.Cleanup(func() {
		cmd.Process.Kill()
		select {
		case <-done:
		case <-time.After(3 * time.Second):
			t.Error("worker cleanup timeout")
		}
	})
	var ports []int
	if err = json.NewDecoder(bufio.NewReader(stdout)).Decode(&ports); err != nil {
		t.Fatal(err)
	}
	return cmd, ports, done
}
func TestRealScanAndOwnedProcessLifecycle(t *testing.T) {
	cmd, portNumbers, _ := startWorker(t, false)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	snapshot, err := Scan(ctx, false)
	if err != nil {
		t.Fatal(err)
	}
	var target Identity
	seen := map[uint32]bool{}
	for _, e := range snapshot.Entries {
		if e.Process.PID == int32(cmd.Process.Pid) {
			seen[e.Port] = true
			target = e.Process
		}
	}
	if !seen[uint32(portNumbers[0])] || !seen[uint32(portNumbers[1])] {
		t.Fatalf("TCP/UDP listener missing: %v", seen)
	}
	if target.Created <= 0 || target.Name == "" {
		t.Fatalf("missing identity: %+v", target)
	}
	op := NewOperator()
	r := op.Execute(ctx, []Identity{target}, false)
	if runtime.GOOS == "windows" {
		if r[0].Status != "graceful_unsupported" {
			t.Fatalf("console worker: %+v", r)
		}
		r = op.Execute(ctx, []Identity{target}, true)
	}
	if r[0].Status != "exited" {
		t.Fatalf("owned worker exit: %+v", r)
	}
}
func TestForceRequiresSeparateRequest(t *testing.T) {
	cmd, _, _ := startWorker(t, true)
	ctx := context.Background()
	target := Inspect(ctx, int32(cmd.Process.Pid))
	op := NewOperator()
	op.Wait = 150 * time.Millisecond
	r := op.Execute(ctx, []Identity{target}, false)
	expected := "still_running"
	if runtime.GOOS == "windows" {
		expected = "graceful_unsupported"
	}
	if r[0].Status != expected {
		t.Fatalf("graceful: %+v", r)
	}
	if actual := Inspect(ctx, target.PID); actual.Created != target.Created {
		t.Fatal("graceful request killed resistant worker")
	}
	r = op.Execute(ctx, []Identity{target}, true)
	if r[0].Status != "exited" {
		t.Fatalf("force: %+v", r)
	}
}
