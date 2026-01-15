import 'package:bot_toast/bot_toast.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'pages/home_page.dart';
import 'providers/home_provider.dart';

void main() {
  runApp(const PortSentinelApp());
}

class PortSentinelApp extends StatelessWidget {
  const PortSentinelApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => HomeProvider()),
      ],
      child: MaterialApp(
        title: 'Port Sentinel',
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
          useMaterial3: true,
        ),
        builder: BotToastInit(),
        navigatorObservers: [BotToastNavigatorObserver()],
        home: const HomePage(),
      ),
    );
  }
}
