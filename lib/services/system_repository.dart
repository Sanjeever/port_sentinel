import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import '../models/port_process_item.dart';

class SystemRepository {
  Future<List<PortProcessItem>> fetchPortProcessList() async {
    try {
      // 1. Run netstat and tasklist in parallel
      final results = await Future.wait([
        Process.run('netstat', ['-ano'], runInShell: true),
        Process.run('tasklist', ['/FO', 'CSV', '/NH'], runInShell: true),
      ]);

      final netstatResult = results[0];
      final tasklistResult = results[1];

      if (netstatResult.exitCode != 0) {
        throw Exception('Failed to run netstat: ${netstatResult.stderr}');
      }

      // 2. Parse outputs in parallel using compute (Isolates)
      // Pass the raw string outputs to the isolate functions
      final netstatOutput = netstatResult.stdout.toString();
      final tasklistOutput = tasklistResult.stdout.toString();

      // We need to parse tasklist first or in parallel to get the map,
      // but to use compute efficiently, we can't share memory.
      // So we parse both independently, then merge.

      final pidToName = await compute(_parseProcessMap, tasklistOutput);
      final rawItems = await compute(_parseNetstat, netstatOutput);

      // 3. Merge process names into items
      // This part is fast enough to do on main thread as it's just a lookup
      for (var item in rawItems) {
        if (item.pid != 0 && pidToName.containsKey(item.pid)) {
          // We can't modify the item since fields are final, but we can't re-create efficiently?
          // Actually, `_parseNetstat` doesn't have the names yet.
          // So `_parseNetstat` will return items with "Unknown" or null names.
          // We can create a new list or just accept that we need to join them.
          // Better approach: Pass both outputs to a single compute function?
          // Or just fill the name here. Since PortProcessItem fields are final,
          // let's make a copyWith or just re-instantiate?
          // Actually, let's just make `processName` mutable? No, immutability is good.
          // Let's create a new list. It's O(N) but N is usually < 1000.
        }
      }

      // Optimization: Do the join in a separate compute if list is huge?
      // For < 5000 items, main thread join is fine (< 10ms).
      // But we can just update the items.
      // Let's modify PortProcessItem to allow setting name later? No.
      // Let's just do the join in the main thread by mapping.

      final List<PortProcessItem> mergedItems = rawItems.map((item) {
        final name = pidToName[item.pid] ?? 'Unknown';
        return PortProcessItem(
          protocol: item.protocol,
          localAddress: item.localAddress,
          remoteAddress: item.remoteAddress,
          state: item.state,
          pid: item.pid,
          port: item.port,
          processName: name,
        );
      }).toList();

      return mergedItems;

    } catch (e) {
      print('Error fetching port list: $e');
      rethrow;
    }
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

// Top-level functions for compute

Map<int, String> _parseProcessMap(String output) {
  final Map<int, String> map = {};
  final lines = LineSplitter.split(output);
  for (var line in lines) {
    // "Image Name","PID","Session Name","Session#","Mem Usage"
    final parts = line.split('","');
    if (parts.length < 2) continue;

    String name = parts[0].replaceAll('"', '');
    String pidStr = parts[1].replaceAll('"', '');

    final int? pid = int.tryParse(pidStr);
    if (pid != null) {
      map[pid] = name;
    }
  }
  return map;
}

List<PortProcessItem> _parseNetstat(String output) {
  final List<String> lines = LineSplitter.split(output).toList();
  final List<PortProcessItem> items = [];

  for (var line in lines) {
    final parts = line.trim().split(RegExp(r'\s+'));
    if (parts.length < 4) continue;

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
        continue;
      }
    } else { // UDP
      if (parts.length >= 4) {
         pidStr = parts[parts.length - 1];
         state = 'UDP';
      }
    }

    final int? pid = int.tryParse(pidStr);
    if (pid == null) continue;

    final int port = _parsePort(localAddr);

    items.add(PortProcessItem(
      protocol: protocol,
      localAddress: localAddr,
      remoteAddress: remoteAddr,
      state: state,
      pid: pid,
      port: port,
      processName: null, // Will be filled later
    ));
  }
  return items;
}

int _parsePort(String address) {
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
