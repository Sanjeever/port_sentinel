package settings

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"sync"
)

type Preferences struct {
	Language    string `json:"language"`
	Theme       string `json:"theme"`
	AutoRefresh bool   `json:"autoRefresh"`
	Interval    int    `json:"interval"`
	Scope       string `json:"scope"`
	Protocol    string `json:"protocol"`
	Sort        string `json:"sort"`
	Ascending   bool   `json:"ascending"`
	Width       int    `json:"width"`
	Height      int    `json:"height"`
	AutoUpdate  bool   `json:"autoUpdate"`
}

func Default() Preferences {
	return Preferences{"system", "system", true, 5, "listening", "ALL", "port", true, 1180, 760, true}
}
func (p Preferences) Validate() error {
	if !slices.Contains([]string{"system", "en", "zh-CN"}, p.Language) || !slices.Contains([]string{"system", "light", "dark"}, p.Theme) || !slices.Contains([]int{2, 5, 10, 30}, p.Interval) || !slices.Contains([]string{"listening", "all"}, p.Scope) || !slices.Contains([]string{"ALL", "TCP", "UDP"}, p.Protocol) || !slices.Contains([]string{"port", "protocol", "pid", "name"}, p.Sort) || p.Width < 680 || p.Width > 7680 || p.Height < 480 || p.Height > 4320 {
		return fmt.Errorf("invalid_settings")
	}
	return nil
}

type Store struct {
	mu     sync.Mutex
	Path   string
	broken bool
}

func UserStore() (*Store, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return nil, err
	}
	return &Store{Path: filepath.Join(dir, "Port Sentinel", "settings.json")}, nil
}
func (s *Store) Load() (Preferences, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	p := Default()
	data, err := os.ReadFile(s.Path)
	if errors.Is(err, os.ErrNotExist) {
		return p, nil
	}
	if err == nil {
		err = json.Unmarshal(data, &p)
	}
	if err == nil {
		err = p.Validate()
	}
	if err != nil {
		s.broken = true
		return Default(), fmt.Errorf("settings_load: %w", err)
	}
	return p, nil
}
func (s *Store) Save(p Preferences) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.broken {
		return fmt.Errorf("settings_corrupt: repair %s before saving", s.Path)
	}
	if err := p.Validate(); err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(s.Path), 0700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(p, "", "  ")
	if err != nil {
		return err
	}
	f, err := os.CreateTemp(filepath.Dir(s.Path), ".settings-")
	if err != nil {
		return err
	}
	defer os.Remove(f.Name())
	if _, err = f.Write(data); err != nil {
		f.Close()
		return err
	}
	if err = f.Sync(); err != nil {
		f.Close()
		return err
	}
	if err = f.Close(); err != nil {
		return err
	}
	return replace(f.Name(), s.Path)
}
