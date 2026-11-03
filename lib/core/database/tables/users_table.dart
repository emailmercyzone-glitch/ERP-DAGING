import 'package:drift/drift.dart';

/// MOD-02: User & RBAC Table (Owner, Admin, Sales)
/// Mengamankan autentikasi lokal via PIN 6-digit & peran akses
@DataClassName('UserEntry')
class UsersTable extends Table {
  @override
  String get tableName => 'users';

  // UUID v4 Primary Key
  TextColumn get id => text()();

  // Identifier & Profil
  TextColumn get username => text().withLength(min: 3, max: 50)();
  TextColumn get fullName => text().withLength(min: 1, max: 100)();
  
  // PIN 6-digit yang telah di-hash dengan Salt (SHA-256 / PBKDF2)
  TextColumn get pinHash => text()();

  // Peran: OWNER, ADMIN, SALES
  TextColumn get role => text().withLength(min: 4, max: 20)();

  // Identifier Toko: Default TOKO_SAMPORA_01 (BR-001)
  TextColumn get storeId => text().withDefault(const Constant('TOKO_SAMPORA_01'))();

  // Status Aktif & Device ID yang tertaut
  BoolColumn get isActive => boolean().withDefault(const Constant(true))();
  TextColumn get boundDeviceId => text().nullable()();

  // Metadata Audit & Sinkronisasi
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get updatedAt => dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get deletedAt => dateTime().nullable()(); // Soft Delete

  @override
  Set<Column> get primaryKey => {id};
}
