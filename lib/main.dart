import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    const ProviderScope(
      child: ErpDagingApp(),
    ),
  );
}

class ErpDagingApp extends StatelessWidget {
  const ErpDagingApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ERP Daging Import - Sampora Banten',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF991B1B), // Dark Crimson / Red Meat Theme
          brightness: Brightness.light,
        ),
        useMaterial3: true,
      ),
      home: const ErpSplashScreen(),
    );
  }
}

class ErpSplashScreen extends StatelessWidget {
  const ErpSplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF1E293B),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.inventory_2_rounded,
              size: 80,
              color: Color(0xFFEF4444),
            ),
            const SizedBox(height: 24),
            const Text(
              'ERP DAGING IMPORT',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                letterSpacing: 2,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Sampora Banten • V4.3 Production Ready',
              style: TextStyle(
                fontSize: 14,
                color: Colors.white.withOpacity(0.7),
              ),
            ),
            const SizedBox(height: 32),
            const CircularProgressIndicator(
              valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFEF4444)),
            ),
          ],
        ),
      ),
    );
  }
}
