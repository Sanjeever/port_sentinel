# 端口哨兵

用于监控端口和管理进程的 Flutter Windows 桌面应用程序。

[English](README.md) | [中文](README_zh.md)

## 功能特性

- **端口监控**：查看当前正在使用的所有 TCP/UDP 端口。
- **进程信息**：查看占用端口的进程（PID 和名称）。
- **搜索与过滤**：
  - 支持按端口、PID 或进程名称搜索。
  - 支持按协议（TCP/UDP）过滤。
- **结束进程**：直接从应用中终止冲突进程。
  - 包含安全确认对话框。
- **自动刷新**：可选的自动数据更新功能。

## 截图

![主页](assets/screenshot/home_page.png)

## 系统要求

- Windows 10 或更高版本。
- 建议使用管理员权限（用于结束系统进程或查看完整详细信息）。

## 开发

1. **安装 Flutter**：确保已安装并配置 Flutter SDK。
2. **运行**：
   ```bash
   flutter pub get
   flutter run -d windows
   ```

## 权限说明

如果在尝试结束进程时遇到“拒绝访问”错误，请以管理员身份运行应用程序。

## 许可证

[MIT](LICENSE)
