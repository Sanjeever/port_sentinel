# Port Sentinel (端口哨兵)

Flutter Windows Desktop application for monitoring ports and managing processes.

## Features

- **Monitor Ports**: View all TCP/UDP ports currently in use.
- **Process Info**: See which process (PID and Name) is using a port.
- **Search & Filter**:
  - Search by Port, PID, or Process Name.
  - Filter by Protocol (TCP/UDP).
- **Kill Process**: Terminate conflicting processes directly from the app.
  - Includes safety confirmation dialog.
- **Auto Refresh**: Optional automatic data update.

## Screenshot

![Home Page](assets/screenshot/home_page.png)

## Requirements

- Windows 10 or later.
- Administrator privileges recommended (for killing system processes or seeing all details).

## Development

1. **Install Flutter**: Ensure Flutter SDK is installed and configured.
2. **Run**:
   ```bash
   flutter pub get
   flutter run -d windows
   ```

## License

[MIT](LICENSE)

## Note on Permissions

If you encounter "Access Denied" when trying to kill a process, please run the application as Administrator.
