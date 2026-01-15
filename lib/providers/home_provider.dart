import 'dart:async';
import 'package:flutter/foundation.dart';
import '../models/port_process_item.dart';
import '../services/system_repository.dart';

class HomeProvider with ChangeNotifier {
  final SystemRepository _repository = SystemRepository();

  List<PortProcessItem> _allItems = [];
  bool _isLoading = false;
  String _error = '';

  // Search & Filter
  String _searchText = '';
  String _protocolFilter = 'ALL'; // ALL, TCP, UDP

  // Sorting
  int _sortColumnIndex = 0;
  bool _sortAscending = true;

  Timer? _autoRefreshTimer;
  bool _isAutoRefresh = false;
  DateTime? _lastRefreshTime;

  bool get isLoading => _isLoading;
  String get error => _error;
  String get searchText => _searchText;
  String get protocolFilter => _protocolFilter;
  bool get isAutoRefresh => _isAutoRefresh;
  DateTime? get lastRefreshTime => _lastRefreshTime;
  int get sortColumnIndex => _sortColumnIndex;
  bool get sortAscending => _sortAscending;

  List<PortProcessItem> get filteredItems {
    var result = _allItems.where((item) {
      // Protocol Filter
      if (_protocolFilter != 'ALL' && item.protocol != _protocolFilter) {
        return false;
      }

      // Search Text
      if (_searchText.isNotEmpty) {
        final query = _searchText.toLowerCase();
        final matchPort = item.port.toString().contains(query);
        final matchPid = item.pid.toString().contains(query);
        final matchName = (item.processName ?? '').toLowerCase().contains(query);

        return matchPort || matchPid || matchName;
      }

      return true;
    }).toList();

    // Sort
    result.sort((a, b) {
      int cmp = 0;
      switch (_sortColumnIndex) {
        case 0: // Port
          cmp = a.port.compareTo(b.port);
          break;
        case 1: // Protocol
          cmp = a.protocol.compareTo(b.protocol);
          break;
        case 2: // PID
          cmp = a.pid.compareTo(b.pid);
          break;
        case 3: // Name
          cmp = (a.processName ?? '').compareTo(b.processName ?? '');
          break;
        default:
          cmp = 0;
      }
      return _sortAscending ? cmp : -cmp;
    });

    return result;
  }

  HomeProvider() {
    refresh();
  }

  void sort(int columnIndex, bool ascending) {
    _sortColumnIndex = columnIndex;
    _sortAscending = ascending;
    notifyListeners();
  }

  Future<void> refresh() async {
    if (_isLoading) return;

    _isLoading = true;
    _error = '';
    notifyListeners();

    try {
      _allItems = await _repository.fetchPortProcessList();
      // Sort by port by default
      _allItems.sort((a, b) => a.port.compareTo(b.port));
      _lastRefreshTime = DateTime.now();
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void setSearchText(String text) {
    _searchText = text;
    notifyListeners();
  }

  void setProtocolFilter(String protocol) {
    _protocolFilter = protocol;
    notifyListeners();
  }

  void toggleAutoRefresh(bool enable) {
    _isAutoRefresh = enable;
    _autoRefreshTimer?.cancel();

    if (enable) {
      _autoRefreshTimer = Timer.periodic(const Duration(seconds: 5), (_) {
        refresh();
      });
    }
    notifyListeners();
  }

  Future<bool> killProcess(int pid) async {
    final success = await _repository.killProcess(pid);
    if (success) {
      // Remove from list immediately for better UX, then refresh
      _allItems.removeWhere((item) => item.pid == pid);
      notifyListeners();

      // Delay refresh slightly to ensure system updates
      Future.delayed(const Duration(milliseconds: 500), refresh);
    }
    return success;
  }

  @override
  void dispose() {
    _autoRefreshTimer?.cancel();
    super.dispose();
  }
}
