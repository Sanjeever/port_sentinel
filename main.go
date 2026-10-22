package main

import (
	"embed"
	"fmt"
	"os"
	"strconv"

	"github.com/Sanjeever/port_sentinel/internal/privilege"
	"github.com/Sanjeever/port_sentinel/internal/update"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "--privileged":
			if err := privilege.Serve(os.Args[2:]); err != nil {
				fmt.Fprintln(os.Stderr, err)
				os.Exit(1)
			}
			return
		case "--apply-update":
			if err := update.Apply(os.Args[2:]); err != nil {
				fmt.Fprintln(os.Stderr, err)
				os.Exit(1)
			}
			return
		}
	}
	app, err := NewApp()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	for i := 1; i < len(os.Args); i++ {
		switch os.Args[i] {
		case "--update-error":
			if i+1 < len(os.Args) {
				app.updateFailure = os.Args[i+1]
				i++
			}
		case "--update-cleanup":
			if i+2 < len(os.Args) {
				pid, e := strconv.Atoi(os.Args[i+2])
				if e != nil {
					app.updateFailure = e.Error()
				} else {
					app.cleanupStage = os.Args[i+1]
					app.cleanupPID = pid
				}
				i += 2
			}
		}
	}
	p := app.service.State().Preferences
	err = wails.Run(&options.App{Title: "Port Sentinel", Width: p.Width, Height: p.Height, MinWidth: 680, MinHeight: 480, AssetServer: &assetserver.Options{Assets: assets}, OnStartup: app.startup, OnDomReady: app.ready, OnBeforeClose: app.beforeClose, OnShutdown: app.shutdown, Bind: []interface{}{app}})
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
