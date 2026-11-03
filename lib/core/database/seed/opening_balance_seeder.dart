import 'package:drift/drift.dart';
import '../app_database.dart';

/// MOD-01 & Bagian 9: Seeder Opening Balance & Setup Awal Toko
/// Menutup Gap P15 & OI-02: Template Migrasi Awal CSV Go-Live
class OpeningBalanceSeeder {
  final AppDatabase db;

  OpeningBalanceSeeder(this.db);

  /// Inisialisasi Toko Utama & Akun Standar (Owner, Admin, Sales)
  Future<void> seedInitialStoreAndUsers() async {
    final now = DateTime.now();

    // Cek apakah sudah ada user
    final existingUsers = await db.select(db.usersTable).get();
    if (existingUsers.isNotEmpty) return;

    // 1. Akun Owner (PIN default 123456 - Hash salt)
    await db.into(db.usersTable).insert(
      UsersCompanion.insert(
        id: 'USER_OWNER_01',
        username: 'owner_sampora',
        fullName: 'Ndoro Juragan Owner',
        pinHash: '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', // SHA-256('123456')
        role: 'OWNER',
        storeId: const Value('TOKO_SAMPORA_01'),
        isActive: const Value(true),
        createdAt: Value(now),
        updatedAt: Value(now),
      ),
    );

    // 2. Akun Admin Gudang
    await db.into(db.usersTable).insert(
      UsersCompanion.insert(
        id: 'USER_ADMIN_01',
        username: 'admin_gudang',
        fullName: 'Admin Gudang Sampora',
        pinHash: '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
        role: 'ADMIN',
        storeId: const Value('TOKO_SAMPORA_01'),
        isActive: const Value(true),
        createdAt: Value(now),
        updatedAt: Value(now),
      ),
    );

    // 3. Akun Sales Lapangan
    await db.into(db.usersTable).insert(
      UsersCompanion.insert(
        id: 'USER_SALES_01',
        username: 'sales_banten_01',
        fullName: 'Sales Lapangan 01',
        pinHash: '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
        role: 'SALES',
        storeId: const Value('TOKO_SAMPORA_01'),
        isActive: const Value(true),
        createdAt: Value(now),
        updatedAt: Value(now),
      ),
    );

    // 4. Default Customer Tiers
    await db.into(db.customerTiersTable).insert(
      CustomerTiersCompanion.insert(
        id: 'TIER_HOREKA',
        tierCode: 'HOREKA',
        name: 'Hotel, Restaurant, Cafe',
        description: const Value('Tier harga partai besar & kontrak suplai mingguan'),
        priorityLevel: const Value(1),
        createdAt: Value(now),
      ),
    );

    await db.into(db.customerTiersTable).insert(
      CustomerTiersCompanion.insert(
        id: 'TIER_RETAIL',
        tierCode: 'RETAIL',
        name: 'Eceran Toko',
        description: const Value('Harga konsumen langsung dan pembelian kecil'),
        priorityLevel: const Value(2),
        createdAt: Value(now),
      ),
    );
  }

  /// Memproses Baris CSV Stok Lot Awal Go-Live (Format OI-02)
  /// Header: sku, lot_code, expiry_date, total_gram, total_pcs, cost_total_rupiah, supplier_code
  Future<void> importOpeningStockLot({
    required String productId,
    required String lotCode,
    required DateTime expiryDate,
    required int totalGram,
    int? totalPcs,
    required BigInt costTotalRupiah,
    required String performedByUserId,
    required String deviceId,
  }) async {
    final lotId = 'LOT_OB_${DateTime.now().millisecondsSinceEpoch}';
    final hppPerGram = costTotalRupiah ~/ BigInt.from(totalGram);

    await db.transaction(() async {
      // 1. Buat record lot
      await db.into(db.lotsTable).insert(
        LotsCompanion.insert(
          id: lotId,
          productId: productId,
          lotCode: lotCode,
          expiryDate: expiryDate,
          initialWeightGram: totalGram,
          currentWeightGram: totalGram,
          currentPcs: Value(totalPcs),
          hppPerGramRupiah: hppPerGram,
          createdAt: Value(DateTime.now()),
          updatedAt: Value(DateTime.now()),
        ),
      );

      // 2. Catat event saldo awal di stock_ledger
      await db.appendStockLedger(
        id: 'LEDGER_OB_$lotId',
        productId: productId,
        lotId: lotId,
        movementType: 'IN_OPENING_BAL',
        weightGram: totalGram,
        pcs: totalPcs,
        referenceNumber: 'OPENING-BALANCE-2026',
        referenceType: 'OPENING_BALANCE',
        hppPerGramRupiah: hppPerGram,
        performedByUserId: performedByUserId,
        deviceId: deviceId,
        notes: 'Migrasi Stok Awal Go-Live V4.3',
      );
    });
  }
}
