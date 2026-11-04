import 'package:flutter_dotenv/flutter_dotenv.dart';

/// ============================================================================
/// CONFIGURATION & ENVIRONMENT ISOLATION (Rule 5)
/// Zero plain-text secrets, Supabase service keys, or hardcoded passwords in code.
/// All sensitive configurations loaded via flutter_dotenv.
/// ============================================================================
class AppConfig {
  static Future<void> init() async {
    try {
      await dotenv.load(fileName: '.env');
    } catch (_) {
      // Graceful fallback if .env is injected via platform environment or CI/CD
    }
  }

  static String get supabaseUrl => dotenv.get('SUPABASE_URL', fallback: '');
  static String get supabaseAnonKey => dotenv.get('SUPABASE_ANON_KEY', fallback: '');
  static String get storeId => dotenv.get('STORE_ID', fallback: 'TOKO_SAMPORA_01');
  static String get appEnvironment => dotenv.get('APP_ENV', fallback: 'production');
}
