package settings

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDefaultsAndPersistence(t *testing.T) {
	s := &Store{Path: filepath.Join(t.TempDir(), "user", "settings.json")}
	p, err := s.Load()
	if err != nil || !p.AutoRefresh || p.Interval != 5 || p.Language != "system" {
		t.Fatalf("defaults: %+v %v", p, err)
	}
	p.AutoRefresh = false
	p.Language = "en"
	p.Width = 900
	if err = s.Save(p); err != nil {
		t.Fatal(err)
	}
	got, err := s.Load()
	if err != nil || got != p {
		t.Fatalf("restore: %+v %v", got, err)
	}
}
func TestCorruptionIsVisibleAndNeverOverwritten(t *testing.T) {
	for _, data := range []string{"{broken", `{"interval":3}`, `{"theme":"fake"}`} {
		t.Run(data, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "settings.json")
			if err := os.WriteFile(path, []byte(data), 0600); err != nil {
				t.Fatal(err)
			}
			s := &Store{Path: path}
			if _, err := s.Load(); err == nil {
				t.Fatal("accepted invalid config")
			}
			if err := s.Save(Default()); err == nil {
				t.Fatal("overwrote corruption")
			}
			got, _ := os.ReadFile(path)
			if string(got) != data {
				t.Fatal("changed original")
			}
		})
	}
}
func TestWriteFailureAndValidation(t *testing.T) {
	dir := t.TempDir()
	s := &Store{Path: filepath.Join(dir, "file", "settings.json")}
	if err := os.WriteFile(filepath.Join(dir, "file"), nil, 0600); err != nil {
		t.Fatal(err)
	}
	if err := s.Save(Default()); err == nil {
		t.Fatal("hidden I/O failure")
	}
	p := Default()
	p.Width = 1
	if err := p.Validate(); err == nil {
		t.Fatal("accepted unusable window")
	}
}
