package update

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"
)

func trustedDownload(value string) error {
	u, err := url.Parse(value)
	if err != nil || u.Scheme != "https" || u.Host != "github.com" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || !strings.HasPrefix(u.Path, "/"+Repository+"/releases/download/") {
		return fmt.Errorf("安装包地址不是项目的 GitHub Release")
	}
	return nil
}
func TrustedReleasePage(value string) bool {
	u, err := url.Parse(value)
	return err == nil && u.Scheme == "https" && u.Host == "github.com" && u.User == nil && u.RawQuery == "" && u.Fragment == "" && strings.HasPrefix(u.Path, "/"+Repository+"/releases/tag/v")
}

func applicationPath(executable string) (string, error) {
	if runtime.GOOS != "darwin" {
		return executable, nil
	}
	app := filepath.Dir(filepath.Dir(filepath.Dir(executable)))
	if filepath.Ext(app) != ".app" {
		return "", fmt.Errorf("请从已安装的 .app 更新")
	}
	return app, nil
}

type progressWriter struct {
	file    *os.File
	manager *Manager
	count   int64
	at      time.Time
}

func (w *progressWriter) Write(p []byte) (int, error) {
	n, err := w.file.Write(p)
	w.count += int64(n)
	if time.Since(w.at) >= 200*time.Millisecond {
		w.at = time.Now()
		w.manager.publish(func(s *State) { s.Downloaded = w.count })
	}
	return n, err
}

// Start 下载后启动独立辅助进程。调用方完成业务退出后关闭父进程管道。
func (m *Manager) Start(ctx context.Context, beforeExit func() error, quit func()) (err error) {
	m.mu.Lock()
	if m.stopping || m.active || m.assetURL == "" || m.state.Version == "" {
		m.mu.Unlock()
		return fmt.Errorf("没有可安装的更新")
	}
	ctx, cancel := context.WithTimeout(ctx, 15*time.Minute)
	m.cancel = cancel
	m.active = true
	m.workers.Add(1)
	m.state.Phase = "downloading"
	m.state.Error = ""
	m.state.ErrorCode = ""
	m.state.Downloaded = 0
	assetURL, assetName := m.assetURL, m.assetName
	m.mu.Unlock()
	if m.changed != nil {
		m.changed()
	}
	defer func() {
		defer m.workers.Done()
		cancel()
		m.mu.Lock()
		m.cancel = nil
		m.active = false
		m.mu.Unlock()
		if err != nil {
			if errors.Is(err, context.Canceled) {
				m.publish(func(s *State) { s.Phase = ""; s.Error = ""; s.ErrorCode = "" })
			} else {
				m.fail(err)
			}
		}
	}()
	getExecutable := os.Executable
	if m.executable != nil {
		getExecutable = m.executable
	}
	executable, err := getExecutable()
	if err != nil {
		return err
	}
	executable, err = filepath.EvalSymlinks(executable)
	if err != nil {
		return err
	}
	target, err := applicationPath(executable)
	if err != nil {
		return err
	}
	stage, err := os.MkdirTemp(filepath.Dir(target), ".port-sentinel-update-")
	if err != nil {
		return fmt.Errorf("安装目录不可写：%w", err)
	}
	started := false
	defer func() {
		if !started {
			if cleanupErr := os.RemoveAll(stage); cleanupErr != nil {
				err = errors.Join(err, cleanupErr)
			}
		}
	}()
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, assetURL, nil)
	if err != nil {
		return err
	}
	response, err := m.Client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("下载安装包失败：HTTP %d", response.StatusCode)
	}
	archive := filepath.Join(stage, assetName)
	file, err := os.OpenFile(archive, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	writer := &progressWriter{file: file, manager: m}
	_, copyErr := io.Copy(writer, io.LimitReader(response.Body, 512<<20+1))
	err = errors.Join(copyErr, file.Close())
	if err != nil {
		return err
	}
	if writer.count > 512<<20 {
		return fmt.Errorf("archive_too_large")
	}
	if total := m.State().Total; total > 0 && writer.count != total {
		return fmt.Errorf("download_size_mismatch: got %d, expected %d", writer.count, total)
	}
	m.publish(func(s *State) { s.Downloaded = writer.count })
	if err = ctx.Err(); err != nil {
		return err
	}
	packageDir := filepath.Join(stage, "package")
	if err = extract(archive, packageDir); err != nil {
		return err
	}
	name := "port-sentinel"
	if runtime.GOOS == "windows" {
		name += ".exe"
	}
	if runtime.GOOS == "darwin" {
		name += ".app"
	}
	source := filepath.Join(packageDir, name)
	info, err := os.Stat(source)
	if err != nil {
		return fmt.Errorf("安装包结构错误：%w", err)
	}
	if runtime.GOOS == "darwin" {
		if !info.IsDir() {
			return fmt.Errorf("安装包缺少 .app")
		}
		if _, err = os.Stat(filepath.Join(source, "Contents", "MacOS", "port-sentinel")); err != nil {
			return err
		}
	} else if !info.Mode().IsRegular() {
		return fmt.Errorf("安装包缺少可执行文件")
	}
	helper := filepath.Join(stage, "updater")
	if runtime.GOOS == "windows" {
		helper += ".exe"
	}
	if err = copyFile(executable, helper, 0700); err != nil {
		return err
	}
	if err = ctx.Err(); err != nil {
		return err
	}
	if err = beforeExit(); err != nil {
		return err
	}
	reader, writerPipe, err := os.Pipe()
	if err != nil {
		return err
	}
	cmd := exec.Command(helper, "--apply-update", strconv.Itoa(os.Getpid()), source, target, stage)
	cmd.Stdin = reader
	hideProcess(cmd)
	err = cmd.Start()
	reader.Close()
	if err != nil {
		writerPipe.Close()
		return err
	}
	started = true
	m.mu.Lock()
	m.parentPipe = writerPipe
	m.mu.Unlock()
	m.publish(func(s *State) { s.Phase = "installing" })
	go quit()
	return nil
}

func copyFile(source, target string, mode os.FileMode) error {
	in, err := os.Open(source)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_EXCL, mode)
	if err != nil {
		return err
	}
	_, err = io.Copy(out, in)
	return errors.Join(err, out.Close())
}

func extract(archive, destination string) error {
	remaining := int64(512 << 20)
	write := func(name string, mode os.FileMode, input io.Reader) error {
		if !filepath.IsLocal(name) || strings.Contains(name, "\\") || mode&os.ModeType != 0 && !mode.IsDir() {
			return fmt.Errorf("安装包包含无效路径：%s", name)
		}
		path := filepath.Join(destination, name)
		if mode.IsDir() {
			return os.MkdirAll(path, 0755)
		}
		if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
			return err
		}
		file, err := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, mode.Perm())
		if err != nil {
			return err
		}
		n, copyErr := io.Copy(file, io.LimitReader(input, remaining+1))
		remaining -= n
		err = copyErr
		if remaining < 0 {
			err = errors.Join(err, fmt.Errorf("archive_too_large"))
		}
		return errors.Join(err, file.Close())
	}
	if strings.HasSuffix(archive, ".zip") {
		reader, err := zip.OpenReader(archive)
		if err != nil {
			return err
		}
		defer reader.Close()
		for _, file := range reader.File {
			input, err := file.Open()
			if err != nil {
				return err
			}
			err = errors.Join(write(file.Name, file.Mode(), input), input.Close())
			if err != nil {
				return err
			}
		}
		return nil
	}
	file, err := os.Open(archive)
	if err != nil {
		return err
	}
	defer file.Close()
	gz, err := gzip.NewReader(file)
	if err != nil {
		return err
	}
	defer gz.Close()
	reader := tar.NewReader(gz)
	for {
		header, err := reader.Next()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return err
		}
		mode := os.FileMode(header.Mode)
		if header.Typeflag == tar.TypeDir {
			mode |= os.ModeDir
		} else if header.Typeflag != tar.TypeReg {
			return fmt.Errorf("安装包包含不支持的文件类型")
		}
		if err = write(header.Name, mode, reader); err != nil {
			return err
		}
	}
}

func Apply(arguments []string) error {
	if len(arguments) != 4 {
		return fmt.Errorf("更新参数无效")
	}
	pid, err := strconv.Atoi(arguments[0])
	if err != nil || pid <= 1 || pid == os.Getpid() {
		return fmt.Errorf("invalid_update_parent")
	}
	source, target, stage := arguments[1], arguments[2], arguments[3]
	if filepath.Dir(stage) != filepath.Dir(target) || !strings.HasPrefix(filepath.Base(stage), ".port-sentinel-update-") || filepath.Dir(filepath.Dir(source)) != stage {
		return fmt.Errorf("更新目录无效")
	}
	if _, err = io.Copy(io.Discard, os.Stdin); err != nil {
		return err
	}
	if err = waitParent(pid); err != nil {
		return err
	}
	previous := filepath.Join(stage, "previous")
	return applyPackage(source, target, previous, stage, launch, waitReady)
}

func applyPackage(source, target, previous, stage string, start func(string, ...string) error, ready func(string) error) error {
	var err error
	if err = replace(source, target, previous); err != nil {
		return errors.Join(err, start(target, "--update-error", err.Error(), "--update-cleanup", stage, strconv.Itoa(os.Getpid())))
	}
	err = start(target, "--update-cleanup", stage, strconv.Itoa(os.Getpid()))
	if err == nil {
		err = ready(stage)
	}
	if err != nil {
		if restoreErr := os.Rename(target, source); restoreErr != nil {
			return errors.Join(err, restoreErr)
		}
		if restoreErr := os.Rename(previous, target); restoreErr != nil {
			return errors.Join(err, restoreErr)
		}
		return errors.Join(err, start(target, "--update-error", err.Error(), "--update-cleanup", stage, strconv.Itoa(os.Getpid())))
	}
	return nil
}

// Confirm 仅在新版窗口完成初始化后确认，防止把启动命令成功当作升级成功。
func Confirm(stage string) error {
	executable, err := os.Executable()
	if err != nil {
		return err
	}
	target, err := applicationPath(executable)
	if err != nil {
		return err
	}
	if filepath.Dir(stage) != filepath.Dir(target) || !strings.HasPrefix(filepath.Base(stage), ".port-sentinel-update-") {
		return fmt.Errorf("invalid_update_stage")
	}
	return os.WriteFile(filepath.Join(stage, "ready"), []byte("ready"), 0600)
}
func waitReady(stage string) error {
	deadline := time.NewTimer(30 * time.Second)
	defer deadline.Stop()
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-deadline.C:
			return fmt.Errorf("new_application_startup_timeout")
		case <-ticker.C:
			if _, err := os.Stat(filepath.Join(stage, "ready")); err == nil {
				return nil
			} else if !os.IsNotExist(err) {
				return err
			}
		}
	}
}

func Cleanup(stage string, pid int) error {
	executable, err := os.Executable()
	if err != nil {
		return err
	}
	target, err := applicationPath(executable)
	if err != nil {
		return err
	}
	if filepath.Dir(stage) != filepath.Dir(target) || !strings.HasPrefix(filepath.Base(stage), ".port-sentinel-update-") {
		return fmt.Errorf("更新临时目录无效")
	}
	if err = waitParent(pid); err != nil {
		return err
	}
	return os.RemoveAll(stage)
}

func replace(source, target, previous string) error {
	if err := os.Rename(target, previous); err != nil {
		return err
	}
	if err := os.Rename(source, target); err != nil {
		return errors.Join(err, os.Rename(previous, target))
	}
	return nil
}

func launch(target string, args ...string) error {
	if runtime.GOOS == "darwin" {
		return exec.Command("open", append([]string{target, "--args"}, args...)...).Start()
	}
	cmd := exec.Command(target, args...)
	cmd.Dir = filepath.Dir(target)
	return cmd.Start()
}
