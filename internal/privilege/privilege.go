package privilege

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/Sanjeever/port_sentinel/internal/ports"
)

type Request struct {
	Operation string           `json:"operation"`
	Targets   []ports.Identity `json:"targets"`
	Force     bool             `json:"force"`
}
type Response struct {
	Snapshot ports.Snapshot `json:"snapshot"`
	Results  []ports.Result `json:"results"`
	Error    *ports.Fault   `json:"error"`
}

func (r Request) Validate(self int32) error {
	switch r.Operation {
	case "scan":
		if len(r.Targets) != 0 || r.Force {
			return fmt.Errorf("invalid_scan_request")
		}
	case "terminate":
		return ports.ValidateTargets(r.Targets, self)
	default:
		return fmt.Errorf("invalid_operation")
	}
	return nil
}

// Run 使用随机一次性令牌与回环套接字传递请求，不把目标文本放入提权命令。
func Run(ctx context.Context, request Request) (Response, error) { return run(ctx, request, launch) }
func run(ctx context.Context, request Request, start func(context.Context, string, []string) error) (Response, error) {
	if err := request.Validate(int32(os.Getpid())); err != nil {
		return Response{}, ports.Failure("invalid_request", err)
	}
	ctx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()
	exe, err := os.Executable()
	if err != nil {
		return Response{}, err
	}
	exe, err = filepath.EvalSymlinks(exe)
	if err != nil {
		return Response{}, err
	}
	self := ports.Inspect(ctx, int32(os.Getpid()))
	if self.Created == 0 {
		return Response{}, ports.Failure("identity_unavailable", nil)
	}
	listener, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		return Response{}, err
	}
	defer listener.Close()
	secret := make([]byte, 32)
	if _, err = rand.Read(secret); err != nil {
		return Response{}, err
	}
	token := hex.EncodeToString(secret)
	args := []string{"--privileged", listener.Addr().String(), token, strconv.Itoa(os.Getpid()), strconv.FormatInt(self.Created, 10)}
	done := make(chan error, 1)
	go func() { done <- start(ctx, exe, args) }()
	accepted := make(chan net.Conn)
	go func() {
		for {
			conn, e := listener.Accept()
			if e != nil {
				return
			}
			select {
			case accepted <- conn:
			case <-ctx.Done():
				conn.Close()
				return
			}
		}
	}()
	for {
		select {
		case <-ctx.Done():
			return Response{}, ports.Failure(ports.Classify(ctx.Err()), ctx.Err())
		case err = <-done:
			if err != nil {
				return Response{}, err
			}
			done = nil
		case conn := <-accepted:
			conn.SetDeadline(time.Now().Add(5 * time.Second))
			var hello string
			err = json.NewDecoder(io.LimitReader(conn, 1024)).Decode(&hello)
			if err != nil || subtle.ConstantTimeCompare([]byte(hello), []byte(token)) != 1 {
				conn.Close()
				continue
			}
			conn.SetDeadline(time.Now().Add(60 * time.Second))
			stopClose := context.AfterFunc(ctx, func() { conn.Close() })
			if err = json.NewEncoder(conn).Encode(request); err == nil {
				var response Response
				err = json.NewDecoder(io.LimitReader(conn, 64<<20)).Decode(&response)
				stopClose()
				conn.Close()
				if err != nil {
					return Response{}, ports.Failure("helper_channel", err)
				}
				if response.Error != nil {
					return response, response.Error
				}
				return response, nil
			}
			stopClose()
			conn.Close()
			return Response{}, ports.Failure("helper_channel", err)
		}
	}
}

func Serve(args []string) error {
	if len(args) != 4 {
		return fmt.Errorf("invalid helper arguments")
	}
	if !elevated() {
		return ports.Failure("permission_denied", nil)
	}
	host, _, err := net.SplitHostPort(args[0])
	if err != nil || host != "127.0.0.1" {
		return fmt.Errorf("invalid helper endpoint")
	}
	secret, err := hex.DecodeString(args[1])
	if err != nil || len(secret) != 32 {
		return fmt.Errorf("invalid helper token")
	}
	pid, err := strconv.ParseInt(args[2], 10, 32)
	if err != nil || pid <= 1 {
		return fmt.Errorf("invalid parent")
	}
	created, err := strconv.ParseInt(args[3], 10, 64)
	if err != nil || created <= 0 {
		return fmt.Errorf("invalid parent identity")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	parent := ports.Inspect(ctx, int32(pid))
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	exe, err = filepath.EvalSymlinks(exe)
	if err != nil {
		return err
	}
	if parent.Created != created || !strings.EqualFold(parent.Path, exe) {
		return fmt.Errorf("untrusted parent")
	}
	conn, err := net.DialTimeout("tcp4", args[0], 3*time.Second)
	if err != nil {
		return err
	}
	defer conn.Close()
	conn.SetDeadline(time.Now().Add(60 * time.Second))
	if err = json.NewEncoder(conn).Encode(args[1]); err != nil {
		return err
	}
	var request Request
	decoder := json.NewDecoder(io.LimitReader(conn, 1<<20))
	decoder.DisallowUnknownFields()
	if err = decoder.Decode(&request); err != nil {
		return err
	}
	if err = request.Validate(int32(os.Getpid())); err != nil {
		return err
	}
	for _, t := range request.Targets {
		if t.PID == int32(pid) {
			return fmt.Errorf("unsafe parent target")
		}
	}
	go func() { var b [1]byte; conn.Read(b[:]); cancel() }()
	response := Response{}
	switch request.Operation {
	case "scan":
		response.Snapshot, err = ports.Scan(ctx, true)
	case "terminate":
		response.Results = ports.NewOperator().Execute(ctx, request.Targets, request.Force)
	}
	if err != nil {
		response.Error = ports.Failure(ports.Classify(err), err)
	}
	return json.NewEncoder(conn).Encode(response)
}
