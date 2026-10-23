package main

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/Sanjeever/port_sentinel/internal/service"
	"github.com/Sanjeever/port_sentinel/internal/settings"
	"github.com/Sanjeever/port_sentinel/internal/update"
)

func TestDevelopmentBuildCannotCheckOrInstallUpdates(t *testing.T) {
	a := &App{service: service.New(context.Background(), &settings.Store{Path: filepath.Join(t.TempDir(), "settings.json")}, nil), updater: update.New(currentBuild().Version, nil)}
	defer a.service.Stop()
	if !currentBuild().Development {
		t.Fatal("test must use development build")
	}
	if a.CheckUpdate() == nil || a.InstallUpdate() == nil {
		t.Fatal("development build allowed updates")
	}
	first, second := a.GetState(), a.GetState()
	if second.Sequence <= first.Sequence || second.Build.Version != currentBuild().Version {
		t.Fatalf("invalid view: %+v", second)
	}
}
