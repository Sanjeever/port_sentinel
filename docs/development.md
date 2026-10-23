# 开发与发布

本文说明本仓库的开发、验证与发布入口，以及必须保留的平台兼容背景。产品入口见 [README](../README_zh.md)，设计约束见[架构与行为约束](architecture.md)。命令、版本与矩阵如有变化，以对应脚本和配置核对并更新本流程。

## 环境与常用入口

Go 版本要求见 [go.mod](../go.mod)，CI 使用的 Go/Node 版本见[检查工作流](../.github/workflows/check.yml)。pnpm 版本来自 [frontend/package.json](../frontend/package.json) 的 `packageManager`，依赖精确版本来自 Go Modules 和前端锁文件。Wails CLI 版本需与 `go.mod` 的 Wails v2 依赖一致；两份工作流包含对应安装命令。

macOS 需要 Xcode Command Line Tools，Windows 需要 WebView2，Ubuntu 需要 `libgtk-3-dev` 与 `libwebkit2gtk-4.1-dev`。Linux 授权操作另需 polkit 和运行中的图形认证代理。Windows 在 Git Bash 执行下面的 shell 命令。

在仓库根目录安装匹配版本的 Wails CLI。以下 Bash 命令从 Go Modules 读取版本；macOS 26 上先按下文设置外部链接参数：

```sh
go install github.com/wailsapp/wails/v2/cmd/wails@$(go list -m -f '{{.Version}}' github.com/wailsapp/wails/v2)
```

然后执行：

```sh
pnpm --dir frontend install --frozen-lockfile
sh scripts/desktop.sh dev
```

```sh
sh scripts/check.sh
sh scripts/desktop.sh build -clean
# 在 macOS 构建 Intel 与 Apple Silicon 通用包
sh scripts/desktop.sh build -clean -platform darwin/universal
```

[desktop.sh](../scripts/desktop.sh) 是开发、原生构建与绑定生成的入口；[check.sh](../scripts/check.sh) 安装锁定依赖，执行前端类型检查、测试和真实构建，然后检查版本、Go 格式、测试与 vet。实际步骤以脚本为准。原生构建产物位于 `build/bin/`。

Wails 在 dev/build 或 `sh scripts/desktop.sh generate` 时生成 `frontend/wailsjs`。该目录与 `frontend/dist` 不提交。前端通过业务适配器访问桌面桥接，单独运行 Vite 不提供 Go 系统能力。桥接接口变更需核对 Go 导出定义与前端手写类型，不能依赖生成目录自动同步业务类型。

## 平台兼容背景

- Go 根包嵌入真实 `frontend/dist`，直接运行 Go 检查前先执行 `pnpm --dir frontend build`，不能创建假占位产物。
- Linux 使用 WebKitGTK 4.1，桌面相关 Go 检查、绑定生成与 Wails 构建应一致使用 `webkit2_41`。检查和桌面脚本已处理标签；直接运行时使用 `go test -tags webkit2_41 ./...`、`go vet -tags webkit2_41 ./...`。
- macOS 部署目标覆盖 CGO 编译、链接与应用元数据。脚本同时设置这些目标，避免二进制所需版本高于声明版本。Go 1.23 在 macOS 26 上需要外部链接，脚本保留此兼容处理；在该环境安装 Wails CLI 时，也为对应 `go install` 命令设置 `GOFLAGS=-ldflags=-linkmode=external`。升级工具链后可根据原生验证重新评估此处理。
- macOS 图标处理保留在 [darwin-icon.sh](../scripts/darwin-icon.sh)。它补全 Finder 需要的标准倍率图层，修改包资源后重新签名；不能把该临时签名当作 Developer ID 签名或公证。

## 配置与隔离验证

持久化字段、默认值和有效范围统一查阅 [internal/settings/settings.go](../internal/settings/settings.go)，不另维护完整 JSON 示例。配置保存在 `os.UserConfigDir()` 下的 `Port Sentinel/settings.json`，即 Windows 的 `%AppData%`、macOS 的 `~/Library/Application Support`，以及 Linux 的 `$XDG_CONFIG_HOME`（未设置时为 `~/.config`）下。

配置读取或校验失败时，界面显示错误，以默认偏好继续当前会话，并阻止保存覆盖原文件。修复该文件或由用户自行移走损坏文件后，重启应用再保存；当前会话不会自动解除损坏保护。写入失败同样需要显示错误。窗口关闭时若保存失败，用户可选择放弃保存退出。

开发构建可将 `PORT_SENTINEL_CONFIG_DIR` 指向专用目录，实际文件为该目录下的 `settings.json`。例如在 Bash 中启动开发窗口：

```sh
PORT_SENTINEL_CONFIG_DIR="$(mktemp -d)" sh scripts/desktop.sh dev
```

正式构建忽略此变量，始终使用当前用户配置目录，不能依靠它隔离正式包。更新安装测试应使用独立安装目录与本地 HTTP 服务，不能替换正在使用的程序；进程测试只能操作测试自行创建的进程和监听端口。Go 生命周期测试位于 `internal/ports/`，前端交互测试使用桥接替身，后者不证明真实系统操作可用。

桌面行为修改应在可用平台进行原生构建与窗口检查。涉及授权时检查普通扫描、成功授权、取消、权限不足和组件缺失的实际反馈；涉及更新时检查取消下载、不可写目录、替换/重启失败及恢复。UI 修改检查英文、简体中文、窄窗口和键盘操作。选择与本次语义变化有关的场景，不要求每次任务重跑全部平台验收。

## 版本与发布

[frontend/package.json](../frontend/package.json) 是应用版本源，[version.go](../version.go) 嵌入其版本。`wails.json` 的产品版本由脚本同步，不独立维护。发布者先编写包含英文和简体中文的 `docs/releases/<version>.md`，然后运行：

```sh
node scripts/version.mjs bump <version>
node scripts/version.mjs check v<version>
```

将版本文件和对应日志放在同一提交。脚本验证正式版本格式、两份版本一致和日志存在且非空；双语内容与同提交要求由评审确认。`docs/releases/` 记录各版本变化，`CHANGELOG.md` 保留 Flutter 1.x 历史。Go + Wails 首版为 2.0.0，Flutter 1.x 用户需手动迁移，不覆盖既有标签、Release 或附件。

构建方式与发布渠道分开：`desktop.sh build` 默认仍是开发构建，禁用更新。发布工作流通过 `PORT_SENTINEL_RELEASE_BUILD=true` 注入正式构建标记，供版本信息和更新能力使用。构建参数及提交信息注入以 [desktop.sh](../scripts/desktop.sh) 和 [version.go](../version.go) 为准。

发布需另获明确授权。[普通 CI](../.github/workflows/check.yml) 定义提交与 PR 的原生验证矩阵；[发布 CI](../.github/workflows/release.yml) 由正式 `v*` 标签触发，验证版本、检查、构建并打包。所有平台附件成功后才创建草稿、带齐附件并公开 Release，写入权限限定于发布任务。矩阵、附件命名和打包布局以工作流为准；修改时同时核对 `internal/update/` 的附件匹配与解包契约。

GitHub Release 正文与应用更新窗口复用对应版本日志。日志中的链接应使用应用可打开的本项目 GitHub 地址；当前渲染不显示图片、不执行 HTML，不依赖仓库相对路径跳转。

macOS 签名、公证凭据由 GitHub Secrets 提供：`MACOS_CERTIFICATE`（Base64 编码的 p12）、`MACOS_CERTIFICATE_PASSWORD`、`MACOS_SIGNING_IDENTITY`、`APPLE_ID`、`APPLE_TEAM_ID`、`APPLE_APP_PASSWORD`。这些值必须全部配置或全部留空，部分配置应失败。实现见 [sign-macos.sh](../scripts/sign-macos.sh)，使用独立临时 keychain，为包内可执行文件与应用签名、公证并附票，退出时清理凭据。凭据留空时保留临时签名且不公证，Windows 包未签名；发布时明确实际状态。

## 历史验证记录与待验收边界

仓库在 v2.0.0 发布后记录的验证基线为：本机 macOS 原生构建和窗口检查、Windows/macOS Universal/Ubuntu 22.04/24.04 的[普通 CI](https://github.com/Sanjeever/port_sentinel/actions/runs/39805341021)、三平台[发布 CI](https://github.com/Sanjeever/port_sentinel/actions/runs/39805342986)通过。这是对应版本的历史记录，不代表后续修改已验证，也不是本次文档审查重新执行的结果。

该基线仍未验收真实管理员认证成功、UAC/polkit、Windows/Linux 图形桌面、macOS 12 与 Intel 设备运行、Developer ID 签名/公证及已安装应用升级重启。后续完成相关实测时，补充对应版本、平台、场景和证据，避免把单元测试或构建成功扩大为平台行为验收。
