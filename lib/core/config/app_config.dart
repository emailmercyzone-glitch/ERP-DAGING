import 'package:flutter_dotenv/flutter_dotenv.dart';

/// ============================================================================
/// CONFIGURATION & ENVIRONMENT ISOLATION (Local-First & Vendor-Agnostic)
/// Aplikasi wajib berjalan penuh tanpa .env maupun koneksi server eksternal.
/// ============================================================================
class AppConfig {
  static Future<void> init() async {
    try {
      await dotenv.load(fileName: '.env');
    } catch (_) {
      // Graceful fallback jika .env tidak ada (APK berjalan mandiri offline)
    }
  }

  static String get defaultBackendAdapter =>
      dotenv.get('BACKEND_ADAPTER', fallback: 'LOCAL_ONLY');
  static String get apiBaseUrl => dotenv.get('API_BASE_URL', fallback: '');
  static String get supabaseUrl => dotenv.get('SUPABASE_URL', fallback: '');
  static String get supabaseAnonKey => dotenv.get('SUPABASE_ANON_KEY', fallback: '');
  static String get storeId => dotenv.get('STORE_ID', fallback: 'TOKO_KARKASIA_01');
  static String get storeName =>
      dotenv.get('STORE_NAME', fallback: 'Toko Daging KARKASIA Sampora');
  static String get appEnvironment => dotenv.get('APP_ENV', fallback: 'production');
}
