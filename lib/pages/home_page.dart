import 'package:flutter/services.dart';
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
            child: _buildList(context),
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
        _buildHeader(context),
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

  Widget _buildHeader(BuildContext context) {
    final provider = context.watch<HomeProvider>();

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

    return Container(
      height: 48.0, // Match itemExtent
      color: isEven ? Colors.white : Colors.grey[50],
      padding: const EdgeInsets.symmetric(vertical: 0), // Handled by alignment or height
      child: Row(
        children: [
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
            tooltip: 'Kill Process',
            onPressed: () => _showKillConfirmDialog(context, item),
          )),
        ],
      ),
    );
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
