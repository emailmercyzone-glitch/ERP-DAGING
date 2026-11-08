import 'package:crypto/crypto.dart';
import 'dart:convert';
import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/database/app_database.dart';
import '../../../core/database/database_provider.dart';

/// Model Status Sesi Pengguna Aktif
class AuthSession {
  final UserEntry user;
  final String deviceId;
  final DateTime loginTime;

  AuthSession({
    required this.user,
    required this.deviceId,
    required this.loginTime,
  });

  bool get isOwner => user.role == 'OWNER';
  bool get isAdmin => user.role == 'ADMIN';
  bool get isSales => user.role == 'SALES';

  bool canAccessGudang() => isOwner || isAdmin;
  bool canResolveConflict() => isOwner;
  bool canApproveCreditOverride() => isOwner;
  bool canVoidTransaction() => isOwner || isAdmin;
}

/// MOD-02: Layanan Autentikasi PIN 6-Digit & Role-Based Access Control (RBAC)
class AuthService extends StateNotifier<AuthSession?> {
  final AppDatabase db;
  static const String _salt = 'SAMPORA_MEAT_SALT_V4_SECURE_';

  AuthService(this.db) : super(null);

  /// Menghitung SHA-256 hash dengan salt untuk PIN 6-digit
  static String hashPin(String pin) {
    if (pin.length != 6 || int.tryParse(pin) == null) {
      throw ArgumentError('PIN wajib terdiri dari 6 digit angka numerik.');
    }
    final bytes = utf8.encode('$_salt$pin');
    return sha256.convert(bytes).toString();
  }

  /// Login menggunakan Username dan PIN 6-digit
  Future<bool> login({
    required String username,
    required String pin,
    required String deviceId,
  }) async {
    // Normalisasi alias username umum (misal: 'owner' -> 'owner_sampora', 'admin' -> 'admin_gudang')
    String targetUsername = username.trim().toLowerCase();
    if (targetUsername == 'owner' || targetUsername == 'owner_karkasia') {
      targetUsername = 'owner_sampora';
    } else if (targetUsername == 'admin' || targetUsername == 'gudang') {
      targetUsername = 'admin_gudang';
    } else if (targetUsername == 'sales' || targetUsername == 'sales_01') {
      targetUsername = 'sales_banten_01';
    }

    final user = await (db.select(db.usersTable)
          ..where((tbl) => 
              (tbl.username.equals(targetUsername) | tbl.username.equals(username)) & 
              tbl.pinHash.equals(hashed) & 
              tbl.isActive.equals(true)))
        .getSingleOrNull();

    if (user == null) {
      return false;
    }

    // Perbarui boundDeviceId jika belum ada
    if (user.boundDeviceId == null) {
      await (db.update(db.usersTable)..where((tbl) => tbl.id.equals(user.id))).write(
        UsersCompanion(boundDeviceId: Value(deviceId), updatedAt: Value(DateTime.now())),
      );
    }

    state = AuthSession(
      user: user,
      deviceId: deviceId,
      loginTime: DateTime.now(),
    );

    // Catat Audit Log Login
    await db.into(db.auditLogsTable).insert(
      AuditLogsCompanion.insert(
        id: 'AUDIT_LOGIN_${DateTime.now().millisecondsSinceEpoch}',
        action: 'USER_LOGIN',
        actorUserId: user.id,
        deviceId: deviceId,
        detailsJson: jsonEncode({'username': user.username, 'role': user.role}),
        timestamp: Value(DateTime.now()),
      ),
    );

    return true;
  }

  /// Logout dari sesi saat ini
  void logout() {
    state = null;
  }

  /// Verifikasi PIN Khusus Owner (Misal untuk Override Plafon Piutang atau Void)
  Future<bool> verifyOwnerPin(String pin) async {
    final hashed = hashPin(pin);
    final owner = await (db.select(db.usersTable)
          ..where((tbl) => tbl.role.equals('OWNER') & tbl.pinHash.equals(hashed) & tbl.isActive.equals(true)))
        .getSingleOrNull();
    return owner != null;
  }
}

final authServiceProvider = StateNotifierProvider<AuthService, AuthSession?>((ref) {
  final db = ref.watch(databaseProvider);
  return AuthService(db);
});
