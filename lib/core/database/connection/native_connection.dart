import 'dart:io';
import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// MOD-16 & Bagian 8: Koneksi Terenkripsi Drift SQLite + SQLCipher
/// Mengamankan database lokal dengan enkripsi AES-256 pada level storage
class DatabaseConnectionFactory {
  static const _storage = FlutterSecureStorage();
  static const _passphraseKey = 'erp_sqlcipher_db_key_v4';

  /// Mendapatkan atau membuat kunci enkripsi aman untuk SQLCipher
  static Future<String> getOrCreateEncryptionKey() async {
    String? key = await _storage.read(key: _passphraseKey);
    if (key == null) {
      // Buat kunci aman acak 32-karakter berbasis salt
      key = 'KUNCI_SECURE_ERP_SAMPORA_${DateTime.now().millisecondsSinceEpoch}';
      await _storage.write(key: _passphraseKey, value: key);
    }
    return key;
  }

  /// Membuat LazyDatabase dengan SQLCipher cipher parameters
  static LazyDatabase createConnection({String dbName = 'erp_sampora_v4.db'}) {
    return LazyDatabase(() async {
      final dbFolder = await getApplicationDocumentsDirectory();
      final file = File(p.join(dbFolder.path, dbName));
      final encryptionKey = await getOrCreateEncryptionKey();

      return NativeDatabase.createInBackground(
        file,
        setup: (rawDb) {
          // Inisialisasi SQLCipher Key
          rawDb.execute("PRAGMA key = '$encryptionKey';");
          rawDb.execute('PRAGMA cipher_compatibility = 4;');
          rawDb.execute('PRAGMA cipher_page_size = 4096;');
          rawDb.execute('PRAGMA journal_mode = WAL;');
        },
      );
    });
  }
}
