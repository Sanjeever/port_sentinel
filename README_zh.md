# 端口哨兵

定位端口冲突、查看本地连接并管理相关进程。Port Sentinel 2 使用 Go + Wails v2，界面采用 React、TypeScript 和 HeroUI。

[English](README.md) | [中文](README_zh.md)

[下载](https://github.com/Sanjeever/port_sentinel/releases/latest) · [更新日志](docs/releases/)

早期版本已收录于阮一峰的[《科技爱好者周刊（第 382 期）》](https://github.com/ruanyf/weekly/blob/master/docs/issue-382.md?plain=1#L187)。[早期发布介绍](https://sanjeev.top/posts/2026/01/15-port-sentinel-release)描述的是原 Flutter 版本。

## 功能特性

- 查看 TCP/UDP、IPv4/IPv6、监听端口或全部连接，以及本地/远端地址、状态、PID、进程名称和可读取的可执行文件路径。
- 按端口、PID、进程名称搜索，筛选协议、数值排序、行菜单、复制和进程详情。
- 全选当前筛选结果，按进程去重后确认结束。正常退出与强制结束分开确认，执行前复核进程身份，执行后重新扫描实际连接。
- 可配置的自动刷新。
- 简体中文和英文，浅色、深色和跟随系统主题，保存本地设置及窗口大小。
- 正式 Release 更新检查、日志、可取消的下载，以及确认后的安装和重启。关闭窗口即退出。

## 截图

![Port Sentinel 2 macOS 原生窗口，简体中文与浅色主题](assets/screenshot/main-macos.png)

## 系统要求

| 平台 | 安装包 | 运行依赖 |
| --- | --- | --- |
| Windows 10/11 amd64 | Windows amd64 `.zip` | Microsoft Edge WebView2 Runtime |
| macOS 12+ Intel / Apple Silicon | macOS Universal `.zip` | 系统 WebKit，安装完整 `.app` |
| Ubuntu 22.04/24.04 amd64 桌面 | Linux amd64 `.tar.gz` | GTK 3、WebKitGTK 4.1；提权需要 polkit 与图形认证代理 |

以上为支持目标。其他 Linux 发行版需要兼容的桌面依赖，尚未验证。平台构建与自动化测试不能替代桌面交互、系统授权或已安装程序升级验收，详见[验证记录与待验收边界](docs/development.md#历史验证记录与待验收边界)。

下载后将整个压缩包解压到可写位置再运行。未提供签名凭据时，macOS 包使用临时签名且未经公证，Windows 包未签名；请按系统要求批准下载的应用。Flutter 1.x 用户需要手动安装 v2。

## 开发

按[开发文档](docs/development.md)准备 Go、Node、pnpm、匹配版本的 Wails CLI 和平台依赖。在仓库根目录执行以下命令，Windows 使用 Git Bash：

```sh
pnpm --dir frontend install --frozen-lockfile
sh scripts/desktop.sh dev
```

```sh
sh scripts/check.sh
sh scripts/desktop.sh build -clean
```

macOS Universal 构建、隔离桌面测试、配置恢复和发布准备见开发文档。本地默认构建禁用更新检查与安装。

## 项目结构与文档

- `internal/`：扫描、进程操作、授权、设置和更新。
- `main.go`、`app.go`：桌面生命周期与 Go/前端桥接。
- `frontend/src/`：界面、国际化和桌面 API 适配。
- [架构与行为约束](docs/architecture.md)：设计理由、契约及代码/测试导航。
- [开发与发布](docs/development.md)：环境准备、平台差异、验证与发布。
- [AGENTS.md](AGENTS.md)：Coding Agent 工作边界与文档一致性规则。
- [版本日志](docs/releases/)与 [Flutter 1.x 历史](CHANGELOG.md)：版本变化记录。

## 权限说明

主界面以普通权限运行，普通扫描显示当前可见范围。主动授权扫描，或已经确认的操作遇到权限不足时，通过 UAC、macOS 管理员对话框或 polkit 请求一次性授权。不安装常驻高权限服务，不保存管理员密码。自动刷新不会请求授权，系统保护仍可能阻止访问。

结束进程会影响它的全部连接，包括未选中的端口。默认请求正常退出；Windows 目标没有适用窗口时，会明确报告不支持正常退出。仍在运行的目标可另行确认强制结束，不递归终止进程树。

设置保存在当前用户的系统配置目录。配置损坏与写入失败会显示错误，损坏文件不会被自动覆盖。搜索词、勾选项和授权状态不跨启动保存。具体位置与恢复方式见开发文档。

## 程序更新

正式构建定期检查本仓库正式 Release，可在设置中关闭自动检查或手动检查。发现新版本在设置入口显示标记，下载和重启需要确认，下载可取消。替换或启动失败时尝试恢复旧程序。安装目录必须可写，更新不会请求管理员权限。

## 许可证

[MIT](LICENSE)
