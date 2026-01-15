import 'dart:convert';
import 'dart:io';
import '../models/port_process_item.dart';

class SystemRepository {
  Future<List<PortProcessItem>> fetchPortProcessList() async {
    try {
      // 1. Get process list (PID -> Name)
      final Map<int, String> pidToName = await _getProcessMap();

      // 2. Get netstat output
      final result = await Process.run('netstat', ['-ano'], runInShell: true);
      if (result.exitCode != 0) {
        throw Exception('Failed to run netstat: ${result.stderr}');
      }

      final String output = result.stdout.toString();
      final List<String> lines = LineSplitter.split(output).toList();
      final List<PortProcessItem> items = [];

      for (var line in lines) {
        final parts = line.trim().split(RegExp(r'\s+'));
        if (parts.length < 4) continue; // Skip headers or malformed lines

        // Typical lines:
        // TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       892
        // UDP    0.0.0.0:5353           *:*                                    3424

        // Protocol
        final protocol = parts[0];
        if (protocol != 'TCP' && protocol != 'UDP') continue;

        final localAddr = parts[1];
        final remoteAddr = parts[2];

        String state = '';
        String pidStr = '';

        if (protocol == 'TCP') {
          if (parts.length >= 5) {
            state = parts[3];
            pidStr = parts[4];
          } else {
            // Unexpected format for TCP
            continue;
          }
        } else { // UDP
          // UDP often has no state, so PID is the 4th element (index 3)
          // But sometimes it might look different?
          // Windows netstat -ano for UDP:
          // UDP    0.0.0.0:123            *:*                                    1234
          // It seems it keeps the column spacing so there is an empty column for state?
          // split(RegExp(r'\s+')) will eat the empty space.
          // So for UDP: [UDP, local, remote, PID] -> length 4
          if (parts.length >= 4) {
             // If length is 4, index 3 is PID.
             // If length is 5, maybe there is a state?
             pidStr = parts[parts.length - 1];
             state = 'UDP'; // Placeholder
          }
        }

        final int? pid = int.tryParse(pidStr);
        if (pid == null) continue;

        // Extract Port
        final int port = _parsePort(localAddr);

        items.add(PortProcessItem(
          protocol: protocol,
          localAddress: localAddr,
          remoteAddress: remoteAddr,
          state: state,
          pid: pid,
          port: port,
          processName: pidToName[pid] ?? 'Unknown',
        ));
      }

      return items;

    } catch (e) {
      print('Error fetching port list: $e');
      rethrow;
    }
  }

  int _parsePort(String address) {
    // IPv4: 0.0.0.0:135 -> 135
    // IPv6: [::]:135 -> 135
    try {
      final lastColonIndex = address.lastIndexOf(':');
      if (lastColonIndex != -1) {
        return int.parse(address.substring(lastColonIndex + 1));
      }
    } catch (e) {
      // ignore
    }
    return 0;
  }

  Future<Map<int, String>> _getProcessMap() async {
    final Map<int, String> map = {};
    try {
      // tasklist /FO CSV /NH
      final result = await Process.run('tasklist', ['/FO', 'CSV', '/NH'], runInShell: true);
      if (result.exitCode != 0) return map;

      final lines = LineSplitter.split(result.stdout.toString());
      for (var line in lines) {
        // "Image Name","PID","Session Name","Session#","Mem Usage"
        // "System Idle Process","0","Services","0","8 K"
        // Regex to match quotes
        final parts = line.split('","');
        if (parts.length < 2) continue;

        // Clean up quotes
        String name = parts[0].replaceAll('"', '');
        String pidStr = parts[1].replaceAll('"', '');

        final int? pid = int.tryParse(pidStr);
        if (pid != null) {
          map[pid] = name;
        }
      }
    } catch (e) {
      print('Error running tasklist: $e');
    }
    return map;
  }

  Future<bool> killProcess(int pid) async {
    try {
      final result = await Process.run('taskkill', ['/F', '/PID', pid.toString()], runInShell: true);
      return result.exitCode == 0;
    } catch (e) {
      print('Error killing process: $e');
      return false;
    }
  }
}
