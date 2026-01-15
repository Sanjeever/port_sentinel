import 'package:bot_toast/bot_toast.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/port_process_item.dart';
import '../providers/home_provider.dart';

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Port Sentinel'),
        actions: [
          Consumer<HomeProvider>(
            builder: (context, provider, _) {
              return Row(
                children: [
                  const Text('Auto Refresh'),
                  Switch(
                    value: provider.isAutoRefresh,
                    onChanged: (val) => provider.toggleAutoRefresh(val),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    icon: const Icon(Icons.refresh),
                    onPressed: provider.isLoading ? null : () => provider.refresh(),
                  ),
                  const SizedBox(width: 16),
                ],
              );
            },
          ),
        ],
      ),
      body: Column(
        children: [
          _buildFilterBar(context),
          if (context.watch<HomeProvider>().isLoading)
            const LinearProgressIndicator(),
          Expanded(
            child: _buildTable(context),
          ),
          _buildStatusBar(context),
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

  Widget _buildTable(BuildContext context) {
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

    return SingleChildScrollView(
      scrollDirection: Axis.vertical,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: DataTable(
          sortColumnIndex: provider.sortColumnIndex,
          sortAscending: provider.sortAscending,
          columns: [
            DataColumn(
              label: const Text('Port'),
              onSort: (index, ascending) => provider.sort(index, ascending),
              numeric: true,
            ),
            DataColumn(
              label: const Text('Protocol'),
              onSort: (index, ascending) => provider.sort(index, ascending),
            ),
            DataColumn(
              label: const Text('PID'),
              onSort: (index, ascending) => provider.sort(index, ascending),
              numeric: true,
            ),
            DataColumn(
              label: const Text('Process Name'),
              onSort: (index, ascending) => provider.sort(index, ascending),
            ),
            const DataColumn(label: Text('Local Address')),
            const DataColumn(label: Text('Remote Address')),
            const DataColumn(label: Text('State')),
            const DataColumn(label: Text('Actions')),
          ],
          rows: items.map((item) {
            final isListening = item.state == 'LISTENING';
            return DataRow(
              cells: [
                DataCell(Text(item.port.toString(),
                  style: const TextStyle(fontWeight: FontWeight.bold))),
                DataCell(Text(item.protocol)),
                DataCell(Text(item.pid.toString())),
                DataCell(Text(item.processName ?? 'Unknown')),
                DataCell(Text(item.localAddress)),
                DataCell(Text(item.remoteAddress)),
                DataCell(
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: isListening ? Colors.green.withOpacity(0.1) : Colors.grey.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(color: isListening ? Colors.green : Colors.grey),
                    ),
                    child: Text(
                      item.state,
                      style: TextStyle(
                        color: isListening ? Colors.green[700] : Colors.grey[700],
                        fontSize: 12,
                      ),
                    ),
                  ),
                ),
                DataCell(
                  IconButton(
                    icon: const Icon(Icons.delete_forever, color: Colors.red),
                    tooltip: 'Kill Process',
                    onPressed: () => _showKillConfirmDialog(context, item),
                  ),
                ),
              ],
            );
          }).toList(),
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

  void _showKillConfirmDialog(BuildContext context, PortProcessItem item) {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Kill Process?'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Are you sure you want to terminate this process?'),
              const SizedBox(height: 16),
              Text('PID: ${item.pid}'),
              Text('Name: ${item.processName ?? "Unknown"}'),
              Text('Port: ${item.port}'),
              const SizedBox(height: 16),
              const Text('This action cannot be undone.', style: TextStyle(color: Colors.red)),
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
              child: const Text('Kill Process'),
            ),
          ],
        );
      },
    );
  }
}
