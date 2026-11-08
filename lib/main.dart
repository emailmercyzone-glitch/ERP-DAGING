import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/config/app_config.dart';
import 'core/database/app_database.dart';
import 'core/database/database_provider.dart';
import 'core/database/connection/native_connection.dart';
import 'core/database/seed/opening_balance_seeder.dart';
import 'features/auth/presentation/login_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await AppConfig.init();

  // 1. Inisialisasi Database Drift & Buat Koneksi
  final connection = DatabaseConnectionFactory.createConnection();
  final db = AppDatabase(connection);

  // 2. Inisialisasi Akun Standar (Owner, Admin, Sales) & Master Seeder Sebelum Login
  final seeder = OpeningBalanceSeeder(db);
  await seeder.seedInitialStoreAndUsers();

  runApp(
    ProviderScope(
      overrides: [
        databaseProvider.overrideWithValue(db),
      ],
      child: const ErpDagingApp(),
    ),
  );
}

class ErpDagingApp extends StatelessWidget {
  const ErpDagingApp({super.key});

  @override
  Widget build(BuildContext context) {
    const primaryNavy = Color(0xFF0F172A);
    const secondarySlate = Color(0xFF1E293B);
    const accentEmerald = Color(0xFF10B981);
    const softOffWhite = Color(0xFFF8FAFC);
    const cardBorder = Color(0xFFE2E8F0);

    return MaterialApp(
      title: 'ERP Daging Import - Sampora Banten',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: softOffWhite,
        colorScheme: const ColorScheme.light(
          primary: primaryNavy,
          secondary: accentEmerald,
          surface: Colors.white,
          error: Color(0xFFEF4444),
          onPrimary: Colors.white,
          onSecondary: Colors.white,
          onSurface: primaryNavy,
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          foregroundColor: primaryNavy,
          elevation: 0,
          scrolledUnderElevation: 1,
          titleTextStyle: TextStyle(
            color: primaryNavy,
            fontSize: 16,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.2,
          ),
          iconTheme: IconThemeData(color: primaryNavy),
        ),
        cardTheme: CardTheme(
          color: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: cardBorder, width: 1),
          ),
          margin: EdgeInsets.zero,
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: cardBorder),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: cardBorder),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: primaryNavy, width: 1.5),
          ),
          hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: primaryNavy,
            foregroundColor: Colors.white,
            minimumSize: const Size.fromHeight(44),
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
            textStyle: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: primaryNavy,
            minimumSize: const Size.fromHeight(44),
            side: const BorderSide(color: cardBorder),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
            textStyle: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        fontFamily: 'Inter',
      ),
      home: const LoginScreen(),
    );
  }
}
