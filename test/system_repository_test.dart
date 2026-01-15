import 'package:flutter_test/flutter_test.dart';
import 'package:port_sentinel/services/system_repository.dart';

void main() {
  test('SystemRepository fetchPortProcessList', () async {
    final repo = SystemRepository();
    final items = await repo.fetchPortProcessList();

    print('Fetched ${items.length} items');
    if (items.isNotEmpty) {
      print('First item: ${items.first}');
      print('Last item: ${items.last}');
    }

    // Check if we have both TCP and UDP if available
    final hasTcp = items.any((i) => i.protocol == 'TCP');
    final hasUdp = items.any((i) => i.protocol == 'UDP');
    print('Has TCP: $hasTcp');
    print('Has UDP: $hasUdp');

    // Check if PID is resolved to name
    final hasName = items.any((i) => i.processName != 'Unknown' && i.processName != null);
    print('Has Process Names: $hasName');
  });
}
