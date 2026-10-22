package update

import (
	"archive/tar"
	"archive/zip"
	"bytes"
	"compress/gzip"
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"
)

type transportFunc func(*http.Request) (*http.Response, error)

func (f transportFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestTrustedSourcesAndPlatforms(t *testing.T) {
	for _, value := range []string{"https://github.com/other/app/releases/download/v3.0.0/file.zip", "http://github.com/" + Repository + "/releases/download/v3/file.zip", "https://github.com@evil.test/" + Repository + "/releases/download/v3/file.zip", "https://github.com/" + Repository + "/releases/download/v3/file.zip?redirect=evil"} {
		if trustedDownload(value) == nil {
			t.Fatal("trusted", value)
		}
	}
	for _, platform := range []string{"windows_amd64", "linux_amd64", "darwin_universal"} {
		ext := ".zip"
		if platform == "linux_amd64" {
			ext = ".tar.gz"
		}
		name := "port-sentinel_3.0.0_" + platform + ext
		m := New("2.0.0", nil)
		m.Platform = platform
		var release Release
		if err := jsonRelease(&release, "v3.0.0", name); err != nil {
			t.Fatal(err)
		}
		if err := m.selectRelease(release); err != nil {
			t.Fatal(err)
		}
		if m.assetName != name || m.State().Notes != "English\n简体中文" {
			t.Fatal("wrong package or notes")
		}
		release.Assets[0].URL = "https://github.com/" + Repository + "/releases/download/v2.1.0/" + name
		if err := m.selectRelease(release); err == nil {
			t.Fatal("accepted wrong tag path")
		}
		release.URL = "https://evil.test/release"
		if err := m.selectRelease(release); err == nil {
			t.Fatal("accepted foreign release page")
		}
	}
}
func jsonRelease(r *Release, tag, name string) error {
	r.Tag = tag
	r.Body = "English\n简体中文"
	r.URL = "https://github.com/" + Repository + "/releases/tag/" + tag
	r.Assets = append(r.Assets, struct {
		Name string `json:"name"`
		URL  string `json:"browser_download_url"`
		Size int64  `json:"size"`
	}{Name: name, URL: "https://github.com/" + Repository + "/releases/download/" + tag + "/" + name})
	return nil
}
func TestCancelCheckAndStop(t *testing.T) {
	started := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { close(started); <-r.Context().Done() }))
	defer server.Close()
	m := New("2.0.0", nil)
	m.Endpoint = server.URL
	done := make(chan error, 1)
	go func() { done <- m.Check(context.Background()) }()
	<-started
	if err := m.Check(context.Background()); err == nil {
		t.Fatal("overlapping update")
	}
	m.Stop()
	select {
	case err := <-done:
		if err == nil || m.State().ErrorCode != "cancelled" {
			t.Fatalf("%v %+v", err, m.State())
		}
	case <-time.After(time.Second):
		t.Fatal("check was not cancelled")
	}
	if err := m.Check(context.Background()); err == nil {
		t.Fatal("check after stop")
	}
}
func TestExtractRejectsLinksAndWindowsTraversal(t *testing.T) {
	for _, name := range []string{"..\\outside", "/absolute", "symlink"} {
		t.Run(name, func(t *testing.T) {
			archive := filepath.Join(t.TempDir(), "package.zip")
			f, _ := os.Create(archive)
			z := zip.NewWriter(f)
			h := &zip.FileHeader{Name: name}
			if name == "symlink" {
				h.SetMode(os.ModeSymlink | 0777)
			}
			w, err := z.CreateHeader(h)
			if err != nil {
				t.Fatal(err)
			}
			w.Write([]byte("../outside"))
			z.Close()
			f.Close()
			if err := extract(archive, filepath.Join(t.TempDir(), "out")); err == nil {
				t.Fatal("accepted unsafe archive")
			}
		})
	}
	root := t.TempDir()
	archive := filepath.Join(root, "linux.tar.gz")
	f, _ := os.Create(archive)
	gz := gzip.NewWriter(f)
	tarWriter := tar.NewWriter(gz)
	tarWriter.WriteHeader(&tar.Header{Name: "port-sentinel", Mode: 0755, Size: 3})
	tarWriter.Write([]byte("new"))
	tarWriter.Close()
	gz.Close()
	f.Close()
	if err := extract(archive, filepath.Join(root, "out")); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(filepath.Join(root, "out", "port-sentinel"))
	if err != nil || string(data) != "new" {
		t.Fatal("tar extraction failed", err)
	}
}

func TestStartupFailureRestoresOldProgram(t *testing.T) {
	root := t.TempDir()
	source, target, previous := filepath.Join(root, "new"), filepath.Join(root, "app"), filepath.Join(root, "previous")
	os.WriteFile(source, []byte("new"), 0700)
	os.WriteFile(target, []byte("old"), 0700)
	calls := 0
	err := applyPackage(source, target, previous, root, func(string, ...string) error { calls++; return nil }, func(string) error { return errors.New("startup failed") })
	if err == nil || calls != 2 {
		t.Fatalf("restore: %v %d", err, calls)
	}
	data, _ := os.ReadFile(target)
	if string(data) != "old" {
		t.Fatal("lost old program")
	}
}
func TestDownloadCancellationLeavesInstalledAppUntouched(t *testing.T) {
	root := t.TempDir()
	executable := filepath.Join(root, "port-sentinel")
	if runtime.GOOS == "windows" {
		executable += ".exe"
	}
	if runtime.GOOS == "darwin" {
		executable = filepath.Join(root, "port-sentinel.app", "Contents", "MacOS", "port-sentinel")
	}
	os.MkdirAll(filepath.Dir(executable), 0755)
	os.WriteFile(executable, []byte("old"), 0700)
	started := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		w.(http.Flusher).Flush()
		close(started)
		<-r.Context().Done()
	}))
	defer server.Close()
	m := New("2.0.0", nil)
	m.state.Version = "3.0.0"
	m.assetName = "update.zip"
	m.assetURL = server.URL
	m.executable = func() (string, error) { return executable, nil }
	done := make(chan error, 1)
	go func() {
		done <- m.Start(context.Background(), func() error { t.Error("cancelled download reached exit"); return nil }, func() { t.Error("cancelled download quit") })
	}()
	<-started
	m.Cancel()
	select {
	case err := <-done:
		if err == nil {
			t.Fatal("download unexpectedly succeeded")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("download did not cancel")
	}
	data, _ := os.ReadFile(executable)
	if string(data) != "old" {
		t.Fatal("changed installed app")
	}
	entries, _ := os.ReadDir(root)
	for _, e := range entries {
		if strings.HasPrefix(e.Name(), ".port-sentinel-update-") {
			t.Fatal("left download staging directory")
		}
	}
}
func TestDownloadIsCheckedBeforeExit(t *testing.T) {
	root := t.TempDir()
	executable := filepath.Join(root, "port-sentinel")
	if runtime.GOOS == "windows" {
		executable += ".exe"
	}
	name := "port-sentinel"
	if runtime.GOOS == "windows" {
		name += ".exe"
	}
	if runtime.GOOS == "darwin" {
		executable = filepath.Join(root, "port-sentinel.app", "Contents", "MacOS", "port-sentinel")
		name = "port-sentinel.app/Contents/MacOS/port-sentinel"
	}
	os.MkdirAll(filepath.Dir(executable), 0755)
	os.WriteFile(executable, []byte("old"), 0700)
	var buffer bytes.Buffer
	z := zip.NewWriter(&buffer)
	h := &zip.FileHeader{Name: name}
	h.SetMode(0755)
	w, _ := z.CreateHeader(h)
	io.WriteString(w, "new")
	z.Close()
	m := New("2.0.0", nil)
	m.state.Version = "3.0.0"
	m.assetName = "update.zip"
	m.assetURL = "https://github.com/" + Repository + "/releases/download/v3.0.0/update.zip"
	m.executable = func() (string, error) { return executable, nil }
	m.Client = &http.Client{Transport: transportFunc(func(*http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 200, Body: io.NopCloser(bytes.NewReader(buffer.Bytes()))}, nil
	})}
	abort := errors.New("before-exit validation failed")
	err := m.Start(context.Background(), func() error { return abort }, func() { t.Error("exited after validation failure") })
	if !errors.Is(err, abort) {
		t.Fatalf("%v", err)
	}
	data, _ := os.ReadFile(executable)
	if string(data) != "old" {
		t.Fatal("replaced before parent exit")
	}
}
