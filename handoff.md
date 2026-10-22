# Port Sentinel v2 迁移交接

## 交接状态与任务目标

迁移实现已落地：Go + Wails v2、React/TypeScript/Vite、Tailwind 3.4、HeroUI 2 与 pnpm，已删除 Flutter 源码、runner、依赖、旧构建与 Repo Tokens 自动化。双语 README、真实 macOS 截图和 `docs/releases/2.0.0.md` 已同步。下文保留访谈决策与验收标准；“实现”与“已实测”必须分别判断。

当前入口为 `sh scripts/desktop.sh dev`、`sh scripts/desktop.sh build -clean`、`sh scripts/check.sh`。macOS Universal 使用 `sh scripts/desktop.sh build -clean -platform darwin/universal`。脚本设置两种架构的 macOS 12.0 CGO/链接目标，处理 Go 1.23/macOS 26 的 `LC_UUID` 链接兼容问题，Linux 统一 `webkit2_41`。开发桌面检查用 `PORT_SENTINEL_CONFIG_DIR` 隔离设置；正式构建不接受该覆盖。

执行期间用户追加授权推送、打标签与验证后公开发布；随后要求停止提权测试，此后未继续执行提权测试。成功管理员认证、UAC/polkit、实际安装升级仍需单独实测，不作为发布流程成功的推断。

### 实现与验证快照（2026-10-22）

| 验收范围 | 实现与证据 |
| --- | --- |
| 扫描与进程 | Windows IP Helper API 表；Linux `/proc` 与 pidfd；macOS NUL 字段协议 lsof。进程身份包含 PID 与创建时间。TCP/UDP、IPv4/IPv6、错误、去重与身份变化有测试。Windows 表解码与 Linux `/proc` 测试在对应平台执行。 |
| 按需授权 | 同一可执行文件在 WebView 初始化前分流；UAC / macOS 系统管理员对话框 / polkit；一次性随机令牌与回环通道、父进程路径/创建时间复核、请求白名单、超时及取消。替身测试覆盖通道隔离、错误与取消；已观察 macOS 系统授权对话框，成功/取消结果的完整真实验收未完成。按用户要求停止进一步提权测试。 |
| 服务与设置 | 扫描/结束串行；失败保留数据并标记过期；普通扫描不延续授权标签；自动刷新不抹掉授权取消反馈。原子保存、损坏配置保护、写入失败、窗口大小与快速连续设置变更均有测试。 |
| 界面 | 端口表格、搜索/协议/范围、数值排序、筛选内全选、去重确认、正常/强制分开、详情、复制、逐项结果、双语和主题已连接 Go 服务。10 项前端测试通过，包含更新目录不可写时的本地化错误及当前窗口的手动下载入口。已用真实 Go 服务和自行创建的 TCP/UDP 进程完成正常退出、拒绝后独立强制确认、详情及路径复制；未操作用户真实进程。 |
| 桌面 | 本机 macOS 26.6.2 arm64 原生构建与真实 `.app` 窗口通过，截图已入库；英文深色 700×600 布局与状态区检查通过。Universal 含 x86_64/arm64，两者 Mach-O 部署目标均为 12.0；临时签名校验通过。关闭窗口后进程退出，无本任务测试进程或辅助进程残留。Intel、macOS 12 设备行为未实测。 |
| 更新 | 限本仓库正式 Release 与平台附件；启动 30 秒/之后 6 小时；用户确认下载安装、取消、归档路径校验、替换恢复、新窗口就绪确认。隔离目录与本地 HTTP 测试覆盖取消、日志、ZIP/tar、失败恢复、开发版限制；没有对正在使用的程序执行升级。 |
| 自动检查 | 本机 `sh scripts/check.sh`、`go test -race -ldflags=-linkmode=external ./...`、`go vet ./...`、版本脚本测试/校验通过。Windows/Linux 内部包和测试已交叉编译；这不等于执行对应平台测试。原生 CI 结果在发布前补记。 |
| 发布 | push/PR 检查 Windows、macOS Universal、Ubuntu 22.04/24.04；正式标签构建 Windows amd64、macOS Universal、Ubuntu 22.04 amd64，全部打包后汇总附件、创建草稿再公开。可选 macOS Developer ID/公证，部分凭据配置失败；未配置则明确分发无 Developer ID、公证的临时签名包。 |

长期开发约定见 `AGENTS.md`。本次不能声称已经验证的项目：真实成功认证和 UAC/polkit 行为、Windows/Linux 图形桌面交互、macOS 12 与 Intel 设备运行、Developer ID 签名/公证、已安装应用的升级与重启。CI 只能证明其实际运行的测试与构建。

CI 首轮已确认 Ubuntu 22.04/24.04 原生测试与构建通过；Windows 检出 CRLF 导致格式检查失败，已添加 `.gitattributes` 固定 LF。macOS runner 改为 `macos-15`：GitHub [公告](https://github.blog/changelog/2026-10-01-github-actions-macos-14-runner-image-retirement/)说明 `macos-14` 将于 2026-11-02 退役并缩减容量，实际已遇到排队；产品最低系统与两种架构部署目标仍为 macOS 12.0。另用本任务创建的 256 个 TCP 与 256 个 IPv6 UDP 监听端口检查真实原生长列表，显示共 540 条连接；检查后全部清理。

## 已核实的起点

访谈日期：2026-10-22。下列信息是访谈时快照，执行前检查是否有后续变化，保护用户已有改动。

| 项目 | 已核实信息 |
| --- | --- |
| 当前仓库 | `/Users/sanjeev/code/go/port_sentinel` |
| 远程仓库 | `Sanjeever/port_sentinel`，保留现有仓库名称和历史 |
| 分支与工作区 | `main`，访谈开始时工作区干净 |
| 迁移前提交 | `c38c83312ffbb8ea3228831dee73946c73e364f0` |
| Flutter 版本 | `pubspec.yaml` 为 `1.0.3`，最新现有标签 `v1.0.3` |
| 参考仓库 | `/Users/sanjeev/code/go/codex-deck`，只读参考 |
| 参考提交 | `7cf7060573ed654867329f3bb65c117b884e6335` |
| 参考技术栈 | Wails v2.12.0；React 19、TypeScript、Vite、Tailwind CSS 4、HeroUI 3；pnpm |
| 参考工具配置 | `go.mod` 声明 Go 1.23.0；工作流使用 Node 26；`packageManager` 为 pnpm 11.20.0 |

这些版本用于定位参考实现，不要求盲目使用最新版，也不要求复制所有依赖。执行时读取实际配置，选择满足产品系统基线的兼容组合并锁定版本；Wails CLI 与 Go 模块版本一致，不切换 Wails v3。

尤其核对 macOS 12 的 Go/CGO 部署目标及系统 WebView 对 Tailwind/HeroUI 所用 CSS 的支持。不能只修改 Info.plist 的最低系统版本便声称兼容；必要的系统更新、WebView2 或 WebKitGTK 版本要求须在双语 README 写清。

旧实现入口：

- `lib/services/system_repository.dart`：执行 `netstat -ano`、`tasklist`，按 PID 关联名称，使用 `taskkill /F`。
- `lib/models/port_process_item.dart`：协议、本地/远端地址、状态、PID、端口、进程名称和路径字段。
- `lib/providers/home_provider.dart`：搜索、协议筛选、排序、刷新与结束进程状态。
- `lib/pages/home_page.dart`：表格、批量选择、单个/批量确认框、右键菜单和复制操作。
- `test/system_repository_test.dart`：依赖真实 Windows 命令，主要打印数据，不能作为新版可靠回归覆盖直接照搬。
- `.github/workflows/build-release.yml`：旧 Flutter Windows 标签发布。
- `.github/workflows/repo-tokens.yml`：统计 Dart 并自动修改双语 README，迁移时删除。

旧实现的缺陷不属于保留契约。例如 PID/端口/协议拼接不足以唯一识别连接，发送结束请求后直接移除列表不能证明退出，解析失败不能用端口 0 代替，结束失败不能只返回没有原因的布尔值。

## 已确认的产品范围

### 平台、版本与边界

| 平台 | 发布架构 | 产品支持基线 | 分发形式 |
| --- | --- | --- | --- |
| Windows | amd64 | Windows 10/11 | 包含程序及必要辅助文件的 ZIP |
| macOS | Universal | macOS 12+，Intel 与 Apple Silicon | 完整 `.app` 的 ZIP |
| Linux | amd64 | Ubuntu 22.04/24.04 桌面环境 | 包含程序及必要辅助文件的 `.tar.gz` |

- 首版应用版本为 `2.0.0`，将来正式标签为 `v2.0.0`。本次实现任务不创建或推送标签。
- 不增加 Windows ARM64、Linux ARM64、移动端、Web 部署、远程主机监控、历史趋势、端口告警或自动杀进程规则。
- 不引入托盘、关闭后驻留、开机启动、账号、云同步、备份或代理管理设置。更新所需网络行为按参考实现适配，不为此新增网络设置模块。
- 关闭窗口即退出，取消扫描/下载并清理按需辅助进程；更新安装的受控退出遵循更新协议，不能中途破坏替换流程。
- 显示名保留 `Port Sentinel`，仓库保留 `port_sentinel`。技术标识、二进制和附件使用项目自身名称，并在构建、更新和文档中保持一致。沿用可用的现有应用图标资产，不复制 Codex Deck 品牌。
- 保留 MIT 许可证、Git 历史、旧标签和旧 Release；不维护 Flutter 运行分支或兼容层。旧版用户手动安装新版，不实现 Flutter 包到 Wails 包的原地升级。

### 端口与进程能力

- 扫描 TCP/UDP、IPv4/IPv6；保留同一端口对应不同地址、不同进程及不同远端的条目。
- 展示本地端口、协议、PID、进程名称、本地/远端地址、连接状态和可读取的可执行文件路径；路径至少在详情中可见和复制。
- 默认“监听端口”：TCP LISTEN 与 UDP 绑定条目；可切换“全部连接”。不要用 TCP 监听规则过滤掉 UDP。
- 按端口、PID、进程名称搜索，名称不区分大小写；提供全部/TCP/UDP 筛选，支持端口、协议、PID、进程名称排序。默认端口升序，数值字段使用数值排序。
- 保留复制 PID、复制端口、行菜单、勾选多行、全选当前筛选结果、单个和批量结束进程。全选不能悄悄扩展到筛选之外。
- 同一进程的多条连接在批量操作中只执行一次，确认框和结果说明进程数、关联端口及影响范围。结束进程会影响该进程的其他连接，不能让用户误认为只关闭选中端口。
- 区分无关联 PID、进程退出、权限不足、路径不可读和扫描失败；保留真实连接，不生成假 PID/名称/路径。UDP 无远端时使用明确的空值语义。
- 普通扫描不能保证完整时表达可见范围；授权扫描也受系统保护边界限制。只凭获得管理员权限不能显示“已完整读取”的假保证。
- 手动/自动刷新共享受控任务，不重叠扫描，不让较早结果覆盖新结果；结束进程期间协调自动刷新与选择。
- 初次启动立即扫描；自动刷新默认开启，每 5 秒一次，可选 2、5、10、30 秒。保存用户开关和间隔；关闭后重启保持关闭。
- 刷新失败保留上次成功数据并标记过期；首次扫描失败与成功空结果不能混淆。显示上次成功刷新时间和当前扫描状态。
- 授权完整扫描是主动操作，自动刷新保持普通权限，不再次弹出系统授权。后续普通扫描成功后标记为普通可见范围，不能继续标为授权扫描结果。

### 结束进程与按需提权

主界面保持普通权限，通过系统授权启动有明确职责的辅助进程，执行一次完整扫描或一次单个/批量进程操作。不安装常驻高权限服务，不在应用内设计管理员密码输入框，不保存密码，不把 Wails WebView 整体提升为 root/管理员。

| 平台 | 实现要求 |
| --- | --- |
| Windows | UAC 授权启动受控辅助进程，主程序保持普通权限 |
| macOS | 系统管理员授权执行一次性辅助操作，兼容 macOS 12，不安装常驻 LaunchDaemon |
| Linux | 使用 polkit 图形授权；组件/认证代理缺失或用户取消时明确反馈，不转入不可见的终端密码提示 |

具体 API 与启动方式由 Agent 阅读官方资料后选择。辅助模式可以是同一可执行文件的受限子命令，也可以是随包分发的专用程序，但必须在初始化 WebView 前分流。打包、更新、签名和进程退出要覆盖实际选择的辅助程序。

必须满足以下行为：

1. 单个/批量操作前确认 PID、名称、关联端口与作用范围；先尝试普通权限，权限不足时只对该已确认操作请求系统授权。不因自动刷新或字段缺失自动弹窗。
2. 默认请求正常退出。目标仍存活或平台不支持该进程的正常退出请求时，给出明确状态和独立的强制结束入口，再次确认后才能强制执行。不得超时自动强制结束。
3. Unix 正常退出和强制退出的信号明确区分；Windows 按目标类型选择可行退出请求。不能把 `TerminateProcess`、强制 `taskkill` 或不支持的信号 API 包装为“正常退出”。请求退出与确认退出必须区分。
4. 批量按进程身份去重，一次请求覆盖该批次，避免逐进程重复请求应用级授权。系统自身是否再次认证由系统决定，不承诺绕过。
5. 执行前复核身份，利用 PID 与可获取的创建时间/等价 OS 身份机制处理 PID 复用；无法可靠复核时明确报错并重新扫描，不猜测目标。
6. 拒绝无效或具有进程组语义的 PID、应用自身与辅助进程等危险目标。可识别的关键系统进程给出额外风险提示，不能照搬 Windows 名称列表当作三平台通用判断。
7. 不默认结束子进程树。逐进程报告已退出、仍在运行、权限不足、受系统保护、身份变化、授权取消与其他错误；批量部分失败不覆盖其余结果。
8. 重新扫描确认端口现状。进程退出后端口被其他进程占用应显示新状态，不误报为旧目标结束失败，也不保留旧成功假象。
9. 辅助进程只接受结构化扫描/进程请求，校验操作、参数与调用来源；采用隔离结果通道，不接受任意 shell 命令。进程名、路径等用户可控文本不能直接拼成高权限命令。
10. 取消、拒绝和超时可观察并可清理；退出不能遗留本应用启动的高权限任务或敏感临时文件。不把系统取消当成扫描成功，也不删除已有可见数据。

进程管理提权不扩展到程序更新。安装位置不可写时显示明确错误和手动下载入口。

### UI 设计契约

用户要求使用 `refero-design-system`，并已在本轮确认以下布局与交互。后续 Agent 读取技能及最新参考后直接实现，无需再暂停等 UI 原型批准；完成后实际检查视觉与交互。

本机技能真身为 `/Users/sanjeev/.agents/skills/refero-design-system/SKILL.md`。其他环境按可用技能入口查找，不将技能文件复制进应用或作为运行依赖。

- 定位为面向开发者的数据密集型桌面工具；采用 codex-deck 的简洁工具风格，HeroUI 组件配合 Tailwind。
- 中性色为主体，危险操作用红色；优先留白、对齐和层级，不加入大面积渐变、营销 Hero、装饰卡片或多余说明。
- 支持浅色、深色、跟随系统，默认跟随系统；复用语义化设计变量，避免组件内散布颜色与尺寸。

```text
Port Sentinel                                      设置
搜索端口 / PID / 进程名
[监听端口 / 全部连接] [全部协议 / TCP / UDP]
[自动刷新] [刷新]                         [授权完整扫描]

勾选  端口  协议  PID  进程名称  本地地址  远端地址  状态  操作
─────────────────────────────────────────────────────────
固定表头、列排序、可滚动的端口列表
选中后出现批量操作区：已选进程与端口数 / 结束进程 / 取消选择

条目数 · 上次刷新时间 · 扫描状态
```

- 主窗口不做无必要的侧边导航。搜索、筛选与刷新清晰可见；授权完整扫描为独立入口，不与普通刷新混淆。
- 点击进程名称打开详情侧栏，展示名称、PID、路径及相关端口；长地址/路径在列表中省略，详情中可完整查看和复制。名称不可读的条目也有可发现的详情入口。
- 行菜单提供复制 PID、复制端口、结束进程；强制结束按前述流程呈现，不能与普通结束混为一个未说明的危险动作。
- 选中后展示批量操作区，显示去重后的进程数量和相关端口数量。刷新时清理失效选择，不能因行索引变化或 PID 复用转移用户选择。
- 设置分“常规 / 关于”。常规放语言、主题和刷新设置；关于放版本、构建信息、自动检查开关、手动检查和更新入口。
- 发现更新在设置入口显示标记，不自动弹窗或抢焦点。安装确认展示目标版本、双语日志、进度、取消下载和错误/手动下载入口。
- 窄窗口优先保留端口、协议、PID、进程及操作，其余通过详情查看；工具栏可换行，英文不可挤掉关键按钮。支持桌面窗口缩放，不扩展移动端产品。
- 清晰区分加载、空列表、无筛选结果、部分可见、过期数据、错误和授权取消。批量结果保留可查看的逐项详情，不用短暂 toast 承载唯一失败信息。
- 破坏性操作保留确认；成功操作优先由状态变化体现，避免机械添加成功 toast。保留键盘操作、可访问名称、焦点管理和表格选择能力。
- 不逐像素复刻 codex-deck；具体间距和尺寸按最新 Refero、HeroUI 能力及本产品数据密度调整。

### i18n 与本地设置

- 支持 `zh-CN`、`en`。设置为跟随系统、简体中文、English，默认跟随系统；中文系统使用简体中文，其余使用英文。
- 用户选择立即生效并保存。跟随系统读取真实系统/运行环境语言，不把构建机语言固化到包中；无法识别时使用英文。
- 使用成熟 i18n 库集中维护字典，具体库由 Agent 选择；不要散布语言判断或靠中文字符串作后端协议。
- 翻译覆盖表格、筛选、菜单、详情、设置、权限、确认、空状态、批量结果、更新、可访问名称和校验错误。日期、时间与数字按语言格式化。
- 后端稳定错误标识配合上下文用于本地化，保留原始系统错误作为诊断详情。系统授权对话框语言由 OS 决定。
- 进程名、路径、IP、协议标识等事实值不翻译，不把技术空值伪装成实际名称。
- 每版日志是一份双语 Markdown，应用直接展示同一份双语正文；第一版不开发按语言拆分远程日志的协议。
- 设置写入当前用户配置目录，与程序和更新临时目录分离。保存语言、主题、自动刷新开关/间隔、列表范围、协议筛选、排序和窗口大小。
- 不跨启动保存搜索词、行勾选、旧扫描数据或高权限授权状态。恢复窗口大小时保证当前显示环境可操作，不要求保存坐标。
- 采用简单明确的数据格式和可靠写入方式。配置损坏、非法值及写入失败明确反馈，不能悄悄覆盖原文件或以假默认值掩盖错误。

## codex-deck 参考入口

按实际需要读取下列位置。参考项目不是本仓库的依赖，也不是复制所有业务模块的模板。

| 内容 | 参考路径 |
| --- | --- |
| 发布矩阵、构建与完整 Release 发布 | `.github/workflows/release.yml` |
| Wails 构建与前端命令 | `go.mod`、`wails.json`、`frontend/package.json` |
| 前端集成、样式、组件用法 | `frontend/vite.config.ts`、`frontend/src/style.css`、`frontend/src/app`、`frontend/src/dialogs` |
| 更新检查与平台匹配 | `internal/update/update.go` |
| 下载、解包、替换、重启与清理 | `internal/update/install.go`、`internal/update/process_windows.go`、`internal/update/process_unix.go` |
| 更新回归覆盖 | `internal/update/update_test.go` |
| 更新桥接与定时检查 | `app.go` 的更新方法与 `startUpdateChecks` |
| 辅助更新模式与生命周期 | `main.go`、`version.go` |
| 更新窗口和设置入口 | `frontend/src/dialogs/UpdateDialog.tsx`、`frontend/src/dialogs/SettingsDialog.tsx` 及相关测试 |
| 版本来源与校验 | `scripts/version.mjs`、`scripts/version.test.mjs` |
| macOS 图标、系统元数据 | `scripts/darwin-icon.sh`、`build/darwin`、`build/windows` |
| 发布与更新设计理由 | `docs/development.md`、`docs/architecture.md` 相关段落 |

复用时替换模块路径、仓库地址、事件名、User-Agent、暂存目录前缀、应用名、包结构、macOS bundle 标识、辅助进程与附件命名。不能残留指向 `Sanjeever/codex-deck` 的实际更新请求或外链动作，也不能运行时依赖本机参考目录。保留复用代码必要的第三方来源与许可声明。

## 发布与更新契约

### 版本与附件

- `frontend/package.json` 的 `version` 为应用版本源；版本脚本同步 `wails.json` 产品版本，Go 从该来源嵌入版本。
- 保留开发/正式构建区分和构建提交号。普通开发构建不自动检查或安装更新。
- bump 前要求非空 `docs/releases/<version>.md`，缺失时不部分修改版本文件。check 校验 `v<version>`、两个版本文件与日志。
- 日志包含英文和简体中文两部分，写真实用户可见变化与必要操作；`2.0.0` 日志解释技术栈替换、平台扩展及旧版手动安装新版。
- 附件名称建议：`port-sentinel_<version>_windows_amd64.zip`、`port-sentinel_<version>_darwin_universal.zip`、`port-sentinel_<version>_linux_amd64.tar.gz`。若采用另一种项目命名，统一工作流、更新匹配、归档结构和文档。
- macOS 包含完整 `.app` 及必要辅助文件；Windows/Linux 同样包含实际运行所需文件。不能因参考项目只打包单个程序而遗漏本项目辅助文件。
- 版本文件、日志与对应同步调整放同一提交，不修改历史标签或附件。

### GitHub Actions

- 用 Wails 流程替换 Flutter 发布，不保留两个 `v*` 发布入口。
- 沿用 Windows amd64、macOS Universal、Linux amd64 矩阵，各平台使用原生 runner。runner 与参考配置保持一致，必要调整依据真实可用性和系统基线查证。
- 安装锁定的 Go、pnpm、Node、Wails CLI 和原生依赖。Linux 用 GTK3 / WebKitGTK 4.1，桌面相关 Go 检查及构建一致携带 `webkit2_41`。
- 版本校验、版本脚本测试、Go 测试和前端检查/测试通过后构建打包；全部成功后汇总附件，先创建完整草稿，再公开正式 Release。
- 正文原样来自 `docs/releases/<version>.md`，与应用更新窗口复用，不新增远程日志服务。
- 写权限限定在发布 job，其余只读。增加普通 push/PR 的三平台检查，让用户后续推送时可验证；本次不为触发 CI 擅自推送。
- 分发限约定 ZIP/tar.gz；第一版不加入 MSI、NSIS、DMG、AppImage、deb/rpm 或商店发布。
- macOS 沿用可选 Secrets：`MACOS_CERTIFICATE`、`MACOS_CERTIFICATE_PASSWORD`、`MACOS_SIGNING_IDENTITY`、`APPLE_ID`、`APPLE_TEAM_ID`、`APPLE_APP_PASSWORD`。配置完整时签名/公证；部分配置错误应失败；未提供证书时明确未签名并继续打包。Windows 首版也允许未签名。
- 使用独立临时 keychain，覆盖实际包内可执行文件的签名要求，再公证、附票。不得将证书、密码或账户数据提交入库。

### 应用内更新

- 从 `Sanjeever/port_sentinel` 的正式 GitHub Release 检查，不接受 draft、prerelease、版本回退或平台不匹配的包。
- 正式版默认启动约 30 秒后后台检查，之后每 6 小时；可保存关闭自动检查的选择，保留手动检查。
- 新版本只在设置入口标记。用户打开确认后展示当前/目标版本及 Markdown 双语日志，忽略远程原始 HTML，外链通过受控入口打开。
- 确认后下载，显示进度并允许取消；失败留在当前程序并保留可理解的错误。开发版不能自动替换自身。
- 使用本项目可信地址和匹配包结构，拒绝路径穿越及不支持的归档条目；不能在移植时丢掉参考项目已有校验。
- 辅助更新进程等待旧进程真实退出后替换并启动新版；替换/启动失败尝试恢复旧程序并暴露错误，正确清理暂存文件和辅助进程。
- 更新不改变用户设置路径，不调用高权限进程管理助手；目录不可写时显示错误和手动下载入口。
- macOS 辅助文件、签名、公证与解包规则必须配合；未经验证不能承诺任意 `.app` 内容、符号链接或只读位置都可更新。
- 模拟更新测试不证明真实安装与重启，按平台分别记录结果。

## README 与 Flutter 清理

迁移实现时再同步重写，不能在代码尚为 Flutter 时把 README 写成已可用的 Wails 产品。

- `README.md` 为英文，`README_zh.md` 为简体中文，互相链接。内容包括用途、实际功能、下载入口、平台要求、权限/授权边界、更新与准确开发命令。
- 两份都保留阮一峰[《科技爱好者周刊（第 382 期）》收录链接](https://github.com/ruanyf/weekly/blob/master/docs/issue-382.md?plain=1#L187)。这是历史收录，不写成对新版跨平台能力的背书。
- 保留[英文介绍文章](https://sanjeev.top/en/posts/2026/01/15-port-sentinel-release)、[中文介绍文章](https://sanjeev.top/posts/2026/01/15-port-sentinel-release)。若仍描述 Flutter，标明早期发布介绍，不暗示文章已重写。
- 保留 MIT 与旧 `CHANGELOG.md` 历史；v2 起引导至按版本维护的双语日志，避免多处维护同一新版内容。
- 删除 `.github/workflows/repo-tokens.yml`、`.github/badges/tokens.svg` 和双语 README 的计数。
- `assets/screenshot/home_page.png` 为旧 Flutter 图。可获取时替换为新版真实截图并核对语言/主题；无法截图时删除旧图及引用，不制作假运行截图。
- 移除旧 `lib/`、`test/` Dart 代码、`pubspec.yaml`、`pubspec.lock`、`.metadata`、Dart 分析配置、旧 `windows/` Flutter runner 等；必要图标先迁入新结构。
- 调整 `.gitignore`、元信息和脚本，让 Go/Wails 的 `build` 源资产可跟踪，编译产物、`frontend/node_modules`、`frontend/dist` 与临时文件不入库。
- 按项目选择管理 Wails 生成绑定，提供可复现生成入口，不手改生成代码解决类型问题。
- 清理运行说明中的 Flutter/Dart 依赖；历史日志、旧版介绍与迁移记录可保留历史词汇。

## 实施顺序与小提交

以下是建议，不要求每条恰好一个提交。可以按依赖调整；每个提交围绕一个可解释的工作单元，带直接相关测试。避免最后一次提交所有改动，也不要为凑数量提交不能运行的空壳。

1. **检查与技术验证。** 阅读本文件和参考入口，检查工作区、工具与原生依赖。尽早验证 macOS 一次性授权、Windows 正常退出语义、Linux polkit 与扫描库的平台覆盖，确认影响包结构的事实，不因接口存在便假设三平台可用。
2. **建立可构建应用。** 引入 Go/Wails v2、React/TypeScript/Vite/Tailwind/HeroUI/pnpm 与必要品牌资产；有可启动入口后移除 Flutter 运行链。例如：`build: 将桌面工程迁移到 Go 与 Wails`。
3. **扫描与进程服务。** 最小业务模型、平台适配、扫描状态和真实信息，补 IPv4/IPv6、部分可见及失败测试。例如：`feat(scan): 实现跨平台端口与进程扫描`。
4. **进程操作与授权。** 正常/强制分离、身份复核、单个/批量、系统授权、请求隔离及取消，配套测试。例如：`feat(process): 支持按需提权与分级结束进程`。
5. **确认的 UI 与设置。** 使用 Refero 技能；完成列表、筛选、选择、详情、确认、批量结果、刷新、主题、i18n 和保存。可拆 UI/i18n/设置，每步连接真实后端。例如：`feat(ui): 实现端口工作区与进程详情侧栏`。
6. **应用内更新。** 改造参考更新管理器、版本来源、日志、安装辅助流程与测试。例如：`feat(update): 接入正式版本检查与程序内更新`。
7. **发布与 CI。** 版本脚本及测试、普通检查与三平台发布，核对归档/更新契约。例如：`ci: 配置三平台检查与 Wails 发布流程`。
8. **文档与清理。** 删除 Repo Tokens，更新双语 README、截图、忽略规则与迁移状态，记录真实验证和限制。例如：`docs: 更新双语使用说明与开发入口`。
9. **首版版本收尾。** 写真实 `docs/releases/2.0.0.md`，版本源、产品版本与日志在同一提交一致。若脚手架阶段就引入 `2.0.0`，同一提交需包含对应日志，后续随实际功能完善，收尾时核对而不重复 bump；也可以先用开发版本，在此阶段统一设为 `2.0.0`。检查最终 diff、提交与工作区。

提交使用 Conventional Commits，描述为简体中文，只包含本任务变更，不夹带用户改动或无关整理。不推送、不打标签、不发布、不修改 codex-deck。

## 验证与验收

### 自动化与原生构建

迁移交付提供可复现入口，按实际平台执行：

```sh
pnpm --dir frontend install --frozen-lockfile
pnpm --dir frontend typecheck
pnpm --dir frontend test
pnpm --dir frontend build
go test ./...
go vet ./...
node --test scripts/version.test.mjs
node scripts/version.mjs check v2.0.0
wails build -clean
```

Go 使用 `gofmt`，前端格式工具按最终项目约定。Linux 使用 WebKitGTK 4.1 时，桌面相关 `go test`、`go vet` 与 `wails build` 统一增加 `-tags webkit2_41`。Go 根包嵌入前端时先构建真实 `frontend/dist`。按最终配置调整命令，不能把不存在的脚本写成验证通过。

至少覆盖以下有维护价值的行为：

| 范围 | 验证内容 |
| --- | --- |
| 扫描 | TCP/UDP、IPv4/IPv6、监听/全部、同端口不同地址、路径缺失、进程消失、部分权限和真实失败 |
| 列表 | 数值排序、名称搜索、组合筛选、连接身份、全选范围、刷新后失效选择 |
| 并发/取消 | 重叠扫描、过期结果、退出取消、结束进程与自动刷新交错 |
| 进程 | 正常/强制分离、未退出、PID 复用、无效/保护目标、批量去重及部分失败 |
| 授权 | 成功、拒绝、取消、组件缺失、超时、结果通道、参数校验和清理 |
| 设置 | 默认刷新开启、保存恢复、非法/损坏配置、写入失败与隔离目录 |
| i18n/主题 | 系统语言、即时切换、字典键完整、错误/确认本地化、主题和英文布局 |
| 更新 | 正式版本选择、平台附件、错误仓库地址、日志、取消、解包、失败恢复与开发版限制 |
| 版本脚本 | bump/check、标签不一致、缺少/空日志、失败不部分修改版本 |

单元测试可替换 OS/授权边界，不得把替身结果称为真实系统验证。集成测试只操作自行创建的受控监听进程，不结束用户开发服务；更新用隔离目录和本地 HTTP 服务，不覆盖真实设置与工作程序。

### 桌面验收与环境限制

本机为 macOS，必须执行本机 Wails 原生构建，并在环境允许的范围内完成以下真实桌面检查；不能执行或观察的项目明确列为未验证：

- 启动后扫描受控 TCP/UDP 监听端口与 PID，普通/授权扫描范围准确。
- 正常结束测试自行创建的进程；拒绝退出的受控目标需要另一次确认才能强制结束。
- 系统授权成功/取消、批量结果、详情与复制。需要真实认证而无法自动完成时列为未验证，不要求用户向 Agent 提供密码。
- 中文/英文、浅色/深色/跟随系统、窗口缩放和键盘焦点，关键按钮及错误可见。
- 自动刷新、筛选、选择与长列表没有明显卡顿或误选，不凭假数据替代系统扫描验收。
- 关闭即退出，无本应用遗留后台任务；检查下载取消及受控更新退出。

Windows/Linux 实现、测试、CI 与发布配置必须完成；没有真实桌面时允许交付并列出待实测项，这不是删除或 stub 平台能力的授权。

CI 配置完成不等于已经运行，交叉编译不等于原生构建，原生构建不等于真实 UAC/polkit/管理员授权和更新重启。macOS Universal 构建也不自动证明两种架构都实测。不能执行时说明具体环境或权限原因。

### 最终交付检查

- 本仓库能独立安装、开发和构建，不依赖 codex-deck 目录，没有 Flutter 运行依赖。
- 已确认功能有真实实现，三平台没有返回空列表的假支持。
- 参考仓库名、更新地址、品牌和业务模块无错误残留，程序只检查 Port Sentinel 正式版本。
- 双语 README、周刊收录、介绍文章、许可证、双语首版日志与代码一致；无 Repo Tokens、过时截图或虚假支持保证。
- 完成本地中文小提交及相应验证，无擅自推送、标签或发布。
- 更新本文件开头的交接状态，记录迁移结果与实际验证范围；长期开发入口同步到 `AGENTS.md`，不向长期约定堆放本次实现细节。
- 最终回复说明实现结果、关键提交、实际检查与通过/失败情况、其他平台和真实授权/更新未验证项，不把实施计划当作完成结果。

## 外部资料入口

用于查证实际约束，不替代已确认的产品决策；执行时阅读适用版本，归档文档须重新验证。

- [Wails v2 安装与平台依赖](https://wails.io/docs/gettingstarted/installation/)
- [HeroUI React 文档](https://heroui.com/en/docs/react/getting-started)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)
- [Refero 最新参考](https://styles.refero.design/)、[本轮 Linear 风格参考](https://styles.refero.design/style/90ce5883-bb24-4466-93f7-801cd617b0d1)：参考层级，不照搬营销页面或固定配色。
- [Windows 权限与辅助进程提权](https://learn.microsoft.com/en-us/windows/win32/secbp/running-with-administrator-privileges)
- [Windows 进程终止语义](https://learn.microsoft.com/en-us/windows/win32/procthread/terminating-a-process)
- [polkit / pkexec](https://polkit.pages.freedesktop.org/polkit/pkexec.1.html)
- [Apple 一次性管理员授权归档资料](https://developer.apple.com/library/archive/technotes/tn2065/_index.html)：候选机制资料，须在目标系统验证。
- [Apple SMAppService](https://developer.apple.com/documentation/servicemanagement/smappservice)：理解边界，不据此引入常驻服务。
- [gopsutil](https://github.com/shirou/gopsutil)：成熟进程/连接库候选，核对所选版本各平台实际实现与权限行为，不因接口存在认定行为一致。
