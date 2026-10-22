package main

import (
	_ "embed"
	"encoding/json"
	"runtime/debug"
	"strings"
)

//go:embed frontend/package.json
var packageInfo []byte

var buildCommit string
var releaseBuild string

type BuildInfo struct {
	Version     string `json:"version"`
	Commit      string `json:"commit"`
	Development bool   `json:"development"`
}

func currentBuild() BuildInfo {
	var pkg struct {
		Version string `json:"version"`
	}
	if err := json.Unmarshal(packageInfo, &pkg); err != nil {
		panic(err)
	}
	commit := buildCommit
	if commit == "" {
		if info, ok := debug.ReadBuildInfo(); ok {
			for _, setting := range info.Settings {
				if setting.Key == "vcs.revision" {
					commit = setting.Value
				}
			}
		}
	}
	return BuildInfo{Version: pkg.Version, Commit: strings.TrimSpace(commit), Development: releaseBuild != "true"}
}
