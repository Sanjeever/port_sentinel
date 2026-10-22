package update

import (
	"archive/zip"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestCheckRelease(t *testing.T) {
	for _, test := range []struct {
		name, tag, asset                 string
		prerelease, wantError, available bool
	}{
		{"new", "v1.10.0", "port-sentinel_1.10.0_windows_amd64.zip", false, false, true},
		{"older", "v1.0.0", "", false, false, false},
		{"missing asset", "v1.3.0", "other.zip", false, true, false},
		{"prerelease", "v1.3.0-rc.1", "", true, true, false},
	} {
		t.Run(test.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Header.Get("User-Agent") != "Port-Sentinel/1.2.0" {
					t.Error("缺少客户端标识")
				}
				release := Release{Tag: test.tag, Prerelease: test.prerelease}
				release.Assets = append(release.Assets, struct {
					Name string `json:"name"`
					URL  string `json:"browser_download_url"`
					Size int64  `json:"size"`
				}{Name: test.asset, URL: "https://github.com/" + Repository + "/releases/download/" + test.tag + "/" + test.asset})
				if err := json.NewEncoder(w).Encode(release); err != nil {
					t.Error(err)
				}
			}))
			defer server.Close()
			manager := New("1.2.0", nil)
			manager.Endpoint = server.URL
			manager.Platform = "windows_amd64"
			err := manager.Check(context.Background())
			if (err != nil) != test.wantError {
				t.Fatalf("检查结果：%v", err)
			}
			if (manager.State().Version != "") != test.available {
				t.Fatal("更新版本错误")
			}
			if manager.State().Phase != "" {
				t.Fatal("检查完成后仍占用任务")
			}
		})
	}
}

func TestCheckReleasePreservesNotes(t *testing.T) {
	for _, test := range []struct{ name, notes string }{
		{"markdown", "## 新增\n\n- 支持 **托盘额度**。\n\n[发布说明](https://github.com/Sanjeever/port_sentinel/releases)\n"},
		{"empty", ""},
	} {
		t.Run(test.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if err := json.NewEncoder(w).Encode(map[string]any{
					"tag_name": "v1.4.0", "body": test.notes,
					"html_url": "https://github.com/" + Repository + "/releases/tag/v1.4.0",
					"assets": []map[string]any{{
						"name":                 "port-sentinel_1.4.0_windows_amd64.zip",
						"browser_download_url": "https://github.com/" + Repository + "/releases/download/v1.4.0/port-sentinel_1.4.0_windows_amd64.zip",
					}},
				}); err != nil {
					t.Error(err)
				}
			}))
			defer server.Close()
			manager := New("1.3.2", nil)
			manager.Endpoint, manager.Platform = server.URL, "windows_amd64"
			if err := manager.Check(context.Background()); err != nil {
				t.Fatal(err)
			}
			state := manager.State()
			if state.Notes != test.notes || state.Version != "1.4.0" || state.URL == "" {
				t.Fatalf("release notes changed or update unavailable: %+v", state)
			}
		})
	}
}

func TestExtractAndRejectTraversal(t *testing.T) {
	for _, name := range []string{"port-sentinel.exe", "../outside"} {
		t.Run(name, func(t *testing.T) {
			root := t.TempDir()
			archive := filepath.Join(root, "update.zip")
			file, err := os.Create(archive)
			if err != nil {
				t.Fatal(err)
			}
			writer := zip.NewWriter(file)
			entry, err := writer.Create(name)
			if err != nil {
				t.Fatal(err)
			}
			if _, err = entry.Write([]byte("package contents")); err != nil {
				t.Fatal(err)
			}
			if err = writer.Close(); err != nil {
				t.Fatal(err)
			}
			if err = file.Close(); err != nil {
				t.Fatal(err)
			}
			err = extract(archive, filepath.Join(root, "package"))
			if name == "../outside" {
				if err == nil {
					t.Fatal("接受越界路径")
				}
				if _, err := os.Stat(filepath.Join(root, "outside")); !os.IsNotExist(err) {
					t.Fatal("写出解压目录")
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			content, err := os.ReadFile(filepath.Join(root, "package", name))
			if err != nil || string(content) != "package contents" {
				t.Fatal("解压内容错误", err)
			}
		})
	}
}

func TestReplaceRestoresOldProgramOnFailure(t *testing.T) {
	root := t.TempDir()
	target := filepath.Join(root, "app")
	previous := filepath.Join(root, "previous")
	if err := os.WriteFile(target, []byte("old"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := replace(filepath.Join(root, "missing"), target, previous); err == nil {
		t.Fatal("缺少新程序时未报错")
	}
	content, err := os.ReadFile(target)
	if err != nil || string(content) != "old" {
		t.Fatal("未恢复旧程序", err)
	}
	if err := os.WriteFile(filepath.Join(root, "new"), []byte("new"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := replace(filepath.Join(root, "new"), target, previous); err != nil {
		t.Fatal(err)
	}
	content, err = os.ReadFile(target)
	if err != nil || string(content) != "new" {
		t.Fatal("新程序未就位", err)
	}
}
