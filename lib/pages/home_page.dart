import 'package:flutter/services.dart';
import 'package:bot_toast/bot_toast.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/port_process_item.dart';
import '../providers/home_provider.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  final Set<String> _selectedKeys = {};
  DateTime? _lastRefreshTime;
  String? _lastError;

  String _getItemKey(PortProcessItem item) => '${item.pid}-${item.port}-${item.protocol}';

  void _toggleSelection(PortProcessItem item) {
    setState(() {
      final key = _getItemKey(item);
      if (_selectedKeys.contains(key)) {
        _selectedKeys.remove(key);
      } else {
        _selectedKeys.add(key);
      }
    });
  }

  void _selectAll(List<PortProcessItem> items) {
    setState(() {
      // Check if all *currently visible* items are selected
      final allVisibleSelected = items.every((item) => _selectedKeys.contains(_getItemKey(item)));

      if (allVisibleSelected) {
        // Deselect all visible items
        for (var item in items) {
          _selectedKeys.remove(_getItemKey(item));
        }
      } else {
        // Select all visible items
        for (var item in items) {
          _selectedKeys.add(_getItemKey(item));
        }
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<HomeProvider>();

    // Clear selection if refresh time changed
    if (provider.lastRefreshTime != _lastRefreshTime) {
      _selectedKeys.clear();
      _lastRefreshTime = provider.lastRefreshTime;
    }

    // Error feedback
    if (provider.error.isNotEmpty && provider.error != _lastError) {
      _lastError = provider.error;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        BotToast.showText(text: provider.error);
      });
    } else if (provider.error.isEmpty) {
      _lastError = null;
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Port Sentinel'),
        actions: [
          _buildRefreshArea(context, provider),
        ],
      ),
      body: Column(
        children: [
          _buildFilterBar(context),
          if (provider.error.isNotEmpty)
            Container(
              width: double.infinity,
              color: Colors.red[50],
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  const Icon(Icons.error_outline, size: 20, color: Colors.red),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      provider.error,
                      style: const TextStyle(color: Colors.red),
                    ),
                  ),
                ],
              ),
            ),
          if (provider.isLoading)
            const LinearProgressIndicator(),
          if (_selectedKeys.isNotEmpty) _buildBatchActionBar(context),
          Expanded(
            child: _buildList(context),
          ),
          _buildStatusBar(context),
        ],
      ),
    );
  }

  Widget _buildRefreshArea(BuildContext context, HomeProvider provider) {
    String lastRefreshText = 'Last refresh: --:--:--';
    if (provider.lastRefreshTime != null) {
      final dt = provider.lastRefreshTime!;
      final h = dt.hour.toString().padLeft(2, '0');
      final m = dt.minute.toString().padLeft(2, '0');
      final s = dt.second.toString().padLeft(2, '0');
      lastRefreshText = 'Last refresh: $h:$m:$s';
    }

    return Padding(
      padding: const EdgeInsets.only(right: 16.0),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Auto Refresh', style: TextStyle(fontSize: 13)),
                  const SizedBox(width: 4),
                  Transform.scale(
                    scale: 0.8,
                    child: Switch(
                      value: provider.isAutoRefresh,
                      onChanged: (val) => provider.toggleAutoRefresh(val),
                    ),
                  ),
                ],
              ),
              Text(
                lastRefreshText,
                style: const TextStyle(fontSize: 11),
              ),
            ],
          ),
          const SizedBox(width: 8),
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh Now',
            onPressed: provider.isLoading ? null : () => provider.refresh(),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterBar(BuildContext context) {
    final provider = context.read<HomeProvider>();
    return Card(
      margin: const EdgeInsets.all(8.0),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                decoration: const InputDecoration(
                  labelText: 'Search (Port, PID, Name)',
                  prefixIcon: Icon(Icons.search),
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
                onChanged: (val) => provider.setSearchText(val),
              ),
            ),
            const SizedBox(width: 16),
            DropdownButton<String>(
              value: context.select<HomeProvider, String>((p) => p.protocolFilter),
              items: const [
                DropdownMenuItem(value: 'ALL', child: Text('Protocol: ALL')),
                DropdownMenuItem(value: 'TCP', child: Text('Protocol: TCP')),
                DropdownMenuItem(value: 'UDP', child: Text('Protocol: UDP')),
              ],
              onChanged: (val) {
                if (val != null) provider.setProtocolFilter(val);
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildList(BuildContext context) {
    final provider = context.watch<HomeProvider>();
    final items = provider.filteredItems;

    if (provider.error.isNotEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 48, color: Colors.red),
            const SizedBox(height: 16),
            Text('Error: ${provider.error}'),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => provider.refresh(),
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    if (items.isEmpty && !provider.isLoading) {
      return const Center(child: Text('No matching ports/processes found.'));
    }

    return Column(
      children: [
        _buildHeader(context, items),
        const Divider(height: 1),
        Expanded(
          child: ListView.builder(
            itemCount: items.length,
            // Fixed height for better performance
            itemExtent: 48.0,
            itemBuilder: (context, index) {
              final item = items[index];
              return _buildListItem(context, item, index % 2 == 0);
            },
          ),
        ),
      ],
    );
  }

  Widget _buildBatchActionBar(BuildContext context) {
    final provider = context.read<HomeProvider>();
    final count = _selectedKeys.length;

    return Container(
      color: Colors.blue[50],
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          Text('$count items selected', style: const TextStyle(fontWeight: FontWeight.bold)),
          const Spacer(),
          ElevatedButton.icon(
            icon: const Icon(Icons.delete_sweep, size: 18),
            label: const Text('Batch Terminate'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
            ),
            onPressed: () => _showBatchKillDialog(context, provider),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader(BuildContext context, List<PortProcessItem> items) {
    final provider = context.watch<HomeProvider>();

    // Checkbox state
    bool? isAllSelected = false;
    if (items.isNotEmpty) {
      final selectedCountInItems = items.where((item) => _selectedKeys.contains(_getItemKey(item))).length;
      if (selectedCountInItems == items.length) {
        isAllSelected = true;
      } else if (selectedCountInItems > 0) {
        isAllSelected = null;
      }
    } else {
      isAllSelected = false;
    }

    Widget buildHeaderCell(String label, int flex, int columnIndex) {
      final isSorted = provider.sortColumnIndex == columnIndex;
      return Expanded(
        flex: flex,
        child: InkWell(
          onTap: () {
            // Toggle direction if already sorted by this column, otherwise default to ascending
            final ascending = isSorted ? !provider.sortAscending : true;
            provider.sort(columnIndex, ascending);
          },
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    label,
                    style: const TextStyle(fontWeight: FontWeight.bold),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (isSorted)
                  Icon(
                    provider.sortAscending ? Icons.arrow_upward : Icons.arrow_downward,
                    size: 16,
                  ),
              ],
            ),
          ),
        ),
      );
    }

    return Container(
      color: Colors.grey[100],
      child: Row(
        children: [
          SizedBox(
            width: 48,
            child: Checkbox(
              value: isAllSelected,
              tristate: true,
              onChanged: (val) => _selectAll(items),
            ),
          ),
          buildHeaderCell('Port', 2, 0),
          buildHeaderCell('Proto', 2, 1),
          buildHeaderCell('PID', 2, 2),
          buildHeaderCell('Name', 4, 3),
          const Expanded(flex: 3, child: Padding(padding: EdgeInsets.all(8.0), child: Text('Local Addr', style: TextStyle(fontWeight: FontWeight.bold)))),
          const Expanded(flex: 3, child: Padding(padding: EdgeInsets.all(8.0), child: Text('Remote Addr', style: TextStyle(fontWeight: FontWeight.bold)))),
          const Expanded(flex: 2, child: Padding(padding: EdgeInsets.all(8.0), child: Text('State', style: TextStyle(fontWeight: FontWeight.bold)))),
          const Expanded(flex: 1, child: Padding(padding: EdgeInsets.all(8.0), child: Text('Action', style: TextStyle(fontWeight: FontWeight.bold)))),
        ],
      ),
    );
  }

  Widget _buildListItem(BuildContext context, PortProcessItem item, bool isEven) {
    final isListening = item.state == 'LISTENING';
    final isSelected = _selectedKeys.contains(_getItemKey(item));

    return GestureDetector(
      onSecondaryTapDown: (details) {
        _showContextMenu(context, details.globalPosition, item);
      },
      child: Container(
        height: 48.0, // Match itemExtent
        color: isSelected ? Colors.blue.withOpacity(0.1) : (isEven ? Colors.white : Colors.grey[50]),
        padding: const EdgeInsets.symmetric(vertical: 0), // Handled by alignment or height
        child: Row(
        children: [
          SizedBox(
            width: 48,
            child: Checkbox(
              value: isSelected,
              onChanged: (val) => _toggleSelection(item),
            ),
          ),
          Expanded(flex: 2, child: _buildCopyableCell(item.port.toString(), fontWeight: FontWeight.bold)),
          Expanded(flex: 2, child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Text(item.protocol),
          )),
          Expanded(flex: 2, child: _buildCopyableCell(item.pid.toString())),
          Expanded(flex: 4, child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Tooltip(
              message: item.processName ?? 'Unknown',
              child: Text(
                item.processName ?? 'Unknown',
                overflow: TextOverflow.ellipsis,
              ),
            ),
          )),
          Expanded(flex: 3, child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Text(item.localAddress, overflow: TextOverflow.ellipsis),
          )),
          Expanded(flex: 3, child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Text(item.remoteAddress, overflow: TextOverflow.ellipsis),
          )),
          Expanded(flex: 2, child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Text(
              item.state,
              style: TextStyle(
                color: isListening ? Colors.green[700] : Colors.grey[700],
                fontSize: 12,
              ),
              overflow: TextOverflow.ellipsis
            ),
          )),
          Expanded(flex: 1, child: IconButton(
            icon: const Icon(Icons.delete_forever, color: Colors.red, size: 20),
            tooltip: 'Terminate process (PID ${item.pid})',
            onPressed: () => _showKillConfirmDialog(context, item),
          )),
        ],
      ),
    ),
    );
  }

  void _showContextMenu(BuildContext context, Offset position, PortProcessItem item) {
    showMenu(
      context: context,
      position: RelativeRect.fromLTRB(
        position.dx,
        position.dy,
        position.dx,
        position.dy,
      ),
      items: [
        const PopupMenuItem(
          value: 'copy_pid',
          child: Row(
            children: [
              Icon(Icons.copy, size: 18),
              SizedBox(width: 8),
              Text('Copy PID'),
            ],
          ),
        ),
        const PopupMenuItem(
          value: 'copy_port',
          child: Row(
            children: [
              Icon(Icons.copy, size: 18),
              SizedBox(width: 8),
              Text('Copy Port'),
            ],
          ),
        ),
        const PopupMenuItem(
          value: 'kill',
          child: Row(
            children: [
              Icon(Icons.dangerous, color: Colors.red, size: 18),
              SizedBox(width: 8),
              Text('Kill Process', style: TextStyle(color: Colors.red)),
            ],
          ),
        ),
      ],
    ).then((value) {
      if (!mounted) return;
      if (value == null) return;
      switch (value) {
        case 'copy_pid':
          Clipboard.setData(ClipboardData(text: item.pid.toString()));
          BotToast.showText(text: 'PID ${item.pid} copied');
          break;
        case 'copy_port':
          Clipboard.setData(ClipboardData(text: item.port.toString()));
          BotToast.showText(text: 'Port ${item.port} copied');
          break;
        case 'kill':
          _showKillConfirmDialog(context, item);
          break;
      }
    });
  }

  Widget _buildCopyableCell(String text, {FontWeight? fontWeight}) {
    return InkWell(
      onTap: () {
        Clipboard.setData(ClipboardData(text: text));
        BotToast.showText(text: 'Copied $text to clipboard');
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
        child: Text(
          text,
          style: TextStyle(fontWeight: fontWeight),
          overflow: TextOverflow.ellipsis,
        ),
      ),
    );
  }

  Widget _buildStatusBar(BuildContext context) {
    final count = context.select<HomeProvider, int>((p) => p.filteredItems.length);
    return Container(
      padding: const EdgeInsets.all(8.0),
      color: Colors.grey[200],
      child: Row(
        children: [
          Text('Total Items: $count'),
          const Spacer(),
          const Text('Data source: netstat & tasklist'),
        ],
      ),
    );
  }

  bool _isSystemProcess(String? name) {
    if (name == null) return false;
    final lowerName = name.toLowerCase();
    const systemNames = {
      'system', 'svchost.exe', 'smss.exe', 'csrss.exe',
      'wininit.exe', 'services.exe', 'lsass.exe', 'winlogon.exe',
      'registry', 'spoolsv.exe'
    };
    return systemNames.contains(lowerName);
  }

  void _showKillConfirmDialog(BuildContext context, PortProcessItem item) {
    final isSystem = _isSystemProcess(item.processName);

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Row(
            children: [
              const Icon(Icons.warning_amber_rounded, color: Colors.red),
              const SizedBox(width: 8),
              const Text('Terminate Process?'),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (isSystem)
                Container(
                  padding: const EdgeInsets.all(8),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: Colors.red[50],
                    border: Border.all(color: Colors.red),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text(
                    'WARNING: This appears to be a critical system process. Terminating it may cause system instability or crash.',
                    style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold),
                  ),
                ),
              Text('Are you sure you want to terminate this process?'),
              const SizedBox(height: 16),
              _buildInfoRow('PID', '${item.pid}'),
              _buildInfoRow('Name', item.processName ?? "Unknown"),
              _buildInfoRow('Port', '${item.port}'),
              _buildInfoRow('Protocol', item.protocol),
              const SizedBox(height: 16),
              const Text('This action cannot be undone.', style: TextStyle(color: Colors.red, fontStyle: FontStyle.italic)),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: Colors.red, foregroundColor: Colors.white),
              onPressed: () async {
                Navigator.of(context).pop();

                final provider = context.read<HomeProvider>();
                final cancel = BotToast.showLoading();
                final success = await provider.killProcess(item.pid);
                cancel();

                if (success) {
                  BotToast.showText(text: 'Process ${item.pid} terminated successfully.');
                } else {
                  BotToast.showText(text: 'Failed to terminate process ${item.pid}. Check permissions.');
                }
              },
              child: const Text('Terminate'),
            ),
          ],
        );
      },
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 60, child: Text('$label:', style: const TextStyle(fontWeight: FontWeight.bold))),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }

  void _showBatchKillDialog(BuildContext context, HomeProvider provider) {
    // 1. Get selected items
    final allItems = provider.filteredItems;
    final selectedItems = allItems.where((item) => _selectedKeys.contains(_getItemKey(item))).toList();

    if (selectedItems.isEmpty) return;

    // 2. Extract unique PIDs
    final uniquePids = selectedItems.map((e) => e.pid).toSet();

    // 3. Check for system processes
    final systemProcesses = selectedItems.where((e) => _isSystemProcess(e.processName)).toList();
    final hasSystemProcess = systemProcesses.isNotEmpty;

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Row(
            children: [
              const Icon(Icons.delete_sweep, color: Colors.red),
              const SizedBox(width: 8),
              const Text('Batch Terminate'),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (hasSystemProcess)
                Container(
                  padding: const EdgeInsets.all(8),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: Colors.red[50],
                    border: Border.all(color: Colors.red),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    'WARNING: Selection contains ${systemProcesses.length} system process(es). Terminating them may cause system instability.',
                    style: const TextStyle(color: Colors.red, fontWeight: FontWeight.bold),
                  ),
                ),
              Text('You are about to terminate ${uniquePids.length} process(es) affecting ${selectedItems.length} port(s).'),
              const SizedBox(height: 16),
              const Text('Selected PIDs:', style: TextStyle(fontWeight: FontWeight.bold)),
              Container(
                constraints: const BoxConstraints(maxHeight: 100),
                child: SingleChildScrollView(
                  child: Text(uniquePids.join(', ')),
                ),
              ),
              const SizedBox(height: 16),
              const Text('This action cannot be undone.', style: TextStyle(color: Colors.red, fontStyle: FontStyle.italic)),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: Colors.red, foregroundColor: Colors.white),
              onPressed: () async {
                Navigator.of(context).pop();

                final cancel = BotToast.showLoading();
                int successCount = 0;
                int failCount = 0;

                // Kill processes
                for (final pid in uniquePids) {
                   final success = await provider.killProcess(pid);
                   if (success) successCount++; else failCount++;
                }

                cancel();

                // Clear selection
                if (mounted) {
                  setState(() {
                    _selectedKeys.clear();
                  });
                }

                BotToast.showText(
                  text: 'Batch operation completed.\nSuccess: $successCount, Failed: $failCount',
                  duration: const Duration(seconds: 4),
                );

                // Refresh list
                if (mounted) {
                  provider.refresh();
                }
              },
              child: const Text('Terminate All'),
            ),
          ],
        );
      },
    );
  }
}
