# Port Sentinel

[English](README.md) | [中文](README_zh.md)

Find port conflicts, inspect local connections and manage their processes. Port Sentinel 2 is a Go + Wails v2 desktop app with a React, TypeScript and HeroUI interface.

[Download](https://github.com/Sanjeever/port_sentinel/releases/latest) · [2.0.0 release notes](docs/releases/2.0.0.md)

The original release was featured in Ruan YiFeng's [Technology Enthusiasts Weekly (Issue 382)](https://github.com/ruanyf/weekly/blob/master/docs/issue-382.md?plain=1#L187). [Original release article](https://sanjeev.top/en/posts/2026/01/15-port-sentinel-release) describes the earlier Flutter version.

## Features

- TCP/UDP and IPv4/IPv6, listening ports or all connections; local/remote addresses, state, PID, process name and readable executable paths.
- Search by port, PID or process name; protocol filtering, numeric sorting, row menus, copying and process details.
- Select the filtered rows and end deduplicated processes after confirmation. Graceful exit and force termination are separate actions. The app checks process identity before acting and refreshes actual connections afterwards.
- Automatic refresh, enabled by default every 5 seconds, with 2/5/10/30 second intervals.
- English and Simplified Chinese; light, dark and system themes; saved local preferences and window size.
- Official Release update checks, release notes, cancellable downloads and confirmed installation/restart. Closing the window exits the app.

## Screenshot

![Port Sentinel 2 on macOS, Simplified Chinese and light theme](assets/screenshot/main-macos.png)

## Requirements

| Platform | Package | Runtime requirements |
| --- | --- | --- |
| Windows 10/11 amd64 | `port-sentinel_2.0.0_windows_amd64.zip` | Microsoft Edge WebView2 Runtime |
| macOS 12+ Intel / Apple Silicon | `port-sentinel_2.0.0_darwin_universal.zip` | System WebKit; install the complete `.app` |
| Ubuntu 22.04/24.04 amd64 desktop | `port-sentinel_2.0.0_linux_amd64.tar.gz` | GTK 3, WebKitGTK 4.1; polkit and a graphical authentication agent for privileged actions |

Other Linux distributions require compatible desktop dependencies and have not been validated. The macOS build targets 12.0 for both architectures. Tailwind 3.4 and HeroUI 2 are used to accommodate older system WebViews. Native CI covers Windows, macOS Universal and both Ubuntu versions; Windows/Linux desktop interaction, macOS 12 and Intel device behavior, real system authorization and installed-app upgrades still require manual validation.

Packages are portable archives. Extract the whole package to a writable location before running. Without signing credentials, macOS builds are ad hoc signed and not notarized; Windows builds are unsigned. Follow your operating system's approval process for downloaded applications. Flutter 1.x users must install v2 manually.

## Development

Use Go 1.23.12, Node 26, pnpm 11.20.0 and Wails CLI v2.12.0. macOS needs Xcode Command Line Tools; Windows needs WebView2; Ubuntu builds need `libgtk-3-dev` and `libwebkit2gtk-4.1-dev`.

```sh
go install github.com/wailsapp/wails/v2/cmd/wails@v2.12.0
pnpm --dir frontend install --frozen-lockfile
sh scripts/desktop.sh dev
```

```sh
sh scripts/check.sh
sh scripts/desktop.sh build -clean
# macOS Universal package:
sh scripts/desktop.sh build -clean -platform darwin/universal
```

Run shell scripts in Git Bash on Windows. `check.sh` runs frontend type checks, tests and a real frontend build before Go tests/vet, plus version checks. The desktop wrapper sets macOS CGO/linker targets to 12.0 and uses external linking for Go 1.23 on macOS 26. On macOS 26, also prefix the Wails CLI installation command with `GOFLAGS=-ldflags=-linkmode=external`. Linux checks/builds consistently use `webkit2_41`.

Wails generates `frontend/wailsjs` during dev/build, or with `sh scripts/desktop.sh generate`; generated bindings and `frontend/dist` are not committed. The small typed adapter is in `frontend/src/api.ts`. Build the real frontend before running Go checks directly. Development builds do not check or install updates. Set `PORT_SENTINEL_CONFIG_DIR` to an isolated directory when testing a development build; release builds always use the user configuration directory.

`internal/ports`, `internal/privilege`, `internal/service`, `internal/settings` and `internal/update` hold the platform adapters and services. `app.go` is the desktop bridge. The repository builds independently; the reference project is not a dependency.

## Note on Permissions

Keep the main window at ordinary privileges. Ordinary scans show the visible subset. An explicit authorized scan, or a confirmed operation that encounters permission denial, requests a one-time helper through UAC, the macOS administrator dialog or polkit. The helper accepts scan/process requests, not arbitrary commands. No resident privileged service or administrator password storage is installed. Automatic refresh never asks for authorization, and system protections can still block access.

Ending a process affects all of its connections, including unselected ports. The default requests graceful exit; Windows targets without a suitable window report that graceful exit is unavailable. A still-running target can be force-ended after a separate confirmation. The app does not recursively terminate process trees.

Preferences are stored in `Port Sentinel/settings.json` under the current user's OS configuration directory. Corrupt configuration and write errors remain visible, and corrupt files are not automatically replaced. Search text, selections and authorization are not restored across launches.

## Updates and releases

Release builds check this repository's stable GitHub Release about 30 seconds after startup, then every 6 hours, unless disabled. A new version marks Settings; downloading and restarting require confirmation. Downloads can be cancelled. Replacement or startup failure attempts to restore the old program. Installation needs a writable directory; updates never request administrator privileges. Signed/notarized installation, real authorization and end-to-end upgrades require platform testing in addition to unit tests.

`frontend/package.json` is the version source. Write a bilingual `docs/releases/<version>.md`, then run `node scripts/version.mjs bump <version>` and commit both version files and notes together. Push/PR CI checks Windows, macOS Universal and Ubuntu 22.04/24.04. A `v*` tag runs the three release builds; the Release is made public after all packages succeed. Release notes are the same Markdown shown by the app. Optional macOS signing credentials are listed in [scripts/sign-macos.sh](scripts/sign-macos.sh); partial credential configuration fails the release job.

## License

[MIT](LICENSE)
