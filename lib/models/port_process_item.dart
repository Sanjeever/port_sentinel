class PortProcessItem {
  final String protocol;
  final String localAddress;
  final String remoteAddress;
  final String state;
  final int pid;
  final int port;
  final String? processName;
  final String? processPath;

  PortProcessItem({
    required this.protocol,
    required this.localAddress,
    required this.remoteAddress,
    required this.state,
    required this.pid,
    required this.port,
    this.processName,
    this.processPath,
  });

  @override
  String toString() {
    return 'PortProcessItem(protocol: $protocol, local: $localAddress, remote: $remoteAddress, state: $state, pid: $pid, port: $port, name: $processName)';
  }
}
