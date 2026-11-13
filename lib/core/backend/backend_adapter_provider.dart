import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../database/database_provider.dart';
import '../database/daos/sync_dao.dart';
import '../sync/sync_engine.dart';
import '../../features/ai/application/gemini_advisor_service.dart';
import '../../features/ai/application/voice_order_parser_service.dart';
import 'backend_adapter.dart';
import 'google_sheets_backend_adapter.dart';
import 'local_only_backend_adapter.dart';
import 'rest_api_backend_adapter.dart';
import 'supabase_backend_adapter.dart';

const _backendConfigStorageKey = 'karkasia_backend_adapter_config_v1';

BackendAdapter createBackendAdapterFromConfig(BackendConfig config) {
  switch (config.adapterType) {
    case BackendAdapterType.restApi:
    case BackendAdapterType.zimaOs:
    case BackendAdapterType.postgresBridge:
      return RestApiBackendAdapter(type: config.adapterType, config: config);
    case BackendAdapterType.supabase:
      return SupabaseBackendAdapter(config: config);
    case BackendAdapterType.googleSheets:
      return GoogleSheetsBackendAdapter(config: config);
    case BackendAdapterType.localOnly:
      return LocalOnlyBackendAdapter();
  }
}

class BackendConfigNotifier extends StateNotifier<BackendConfig> {
  final FlutterSecureStorage _storage;

  BackendConfigNotifier([FlutterSecureStorage? storage])
      : _storage = storage ?? const FlutterSecureStorage(),
        super(BackendConfig.fromEnvironmentDefaults()) {
    loadSavedConfig();
  }

  Future<void> loadSavedConfig() async {
    try {
      final raw = await _storage.read(key: _backendConfigStorageKey);
      if (raw != null && raw.isNotEmpty) {
        final decoded = jsonDecode(raw);
        if (decoded is Map<String, dynamic>) {
          state = BackendConfig.fromJson(decoded);
        }
      }
    } catch (_) {
      // Fallback ke default Local-Only Mode jika storage belum tersedia
    }
  }

  Future<void> updateConfig(BackendConfig nextConfig) async {
    state = nextConfig;
    try {
      await _storage.write(
        key: _backendConfigStorageKey,
        value: jsonEncode(nextConfig.toJson()),
      );
    } catch (_) {}
  }
}

final backendConfigProvider = StateNotifierProvider<BackendConfigNotifier, BackendConfig>(
  (ref) => BackendConfigNotifier(),
);

final backendAdapterProvider = Provider<BackendAdapter>((ref) {
  final config = ref.watch(backendConfigProvider);
  return createBackendAdapterFromConfig(config);
});

final syncDaoProvider = Provider<SyncDao>((ref) {
  final db = ref.watch(databaseProvider);
  return SyncDao(db);
});

final syncEngineProvider = Provider<SyncEngine>((ref) {
  final db = ref.watch(databaseProvider);
  final syncDao = ref.watch(syncDaoProvider);
  final adapter = ref.watch(backendAdapterProvider);
  final config = ref.watch(backendConfigProvider);
  return SyncEngine(
    db: db,
    syncDao: syncDao,
    adapter: adapter,
    deviceId: 'ANDROID_HP',
    storeId: config.storeId,
  );
});

final outboxStatsProvider = FutureProvider<OutboxStats>((ref) async {
  final syncDao = ref.watch(syncDaoProvider);
  return syncDao.getOutboxStats();
});

final geminiAdvisorServiceProvider = Provider<GeminiAdvisorService>((ref) {
  final db = ref.watch(databaseProvider);
  final adapter = ref.watch(backendAdapterProvider);
  return GeminiAdvisorService(db: db, adapter: adapter);
});

final voiceOrderParserServiceProvider = Provider<VoiceOrderParserService>((ref) {
  final adapter = ref.watch(backendAdapterProvider);
  return VoiceOrderParserService(adapter: adapter);
});

