import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app_database.dart';
import 'connection/native_connection.dart';

/// Provider singleton global untuk AppDatabase Drift
final databaseProvider = Provider<AppDatabase>((ref) {
  final connection = DatabaseConnectionFactory.createConnection();
  final database = AppDatabase(connection);

  // Pastikan database ditutup dengan aman ketika provider di-dispose
  ref.onDispose(() {
    database.close();
  });

  return database;
});
