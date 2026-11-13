import 'dart:convert';
import 'package:drift/drift.dart';
import '../../../core/database/app_database.dart';

/// Permintaan Pengeluaran Kasir Kecil
class OpexExpenseRequest {
  final String category; // ES_PACKING, BENSIN_PENGIRIMAN, LISTRIK_COLDSTORAGE, PLASTIK_VAKUM, MAKAN_KARYAWAN, LAINNYA
  final String description;
  final BigInt amountRupiah;
  final String paidByUserId;
  final String? receiptPhotoQueueId; // Bukti foto struk kompresi MOD-20

  OpexExpenseRequest({
    required this.category,
    required this.description,
    required this.amountRupiah,
    required this.paidByUserId,
    this.receiptPhotoQueueId,
  });
}

/// MOD-12: Layanan Kasir Kecil & OPEX Harian (Es Balok, Plastik, BBM)
class PettyCashService {
  final AppDatabase db;

  PettyCashService(this.db);

  /// Mencatat Pengeluaran Operasional Kecil ke petty_cash_opex_table
  Future<PettyCashOpexEntry> recordExpense(OpexExpenseRequest req) async {
    final now = DateTime.now();
    final voucherNumber = 'OPEX-${now.year.toString().substring(2)}${now.month.toString().padLeft(2, '0')}${now.day.toString().padLeft(2, '0')}-${now.millisecondsSinceEpoch.toString().substring(9)}';
    final id = 'OPEX_${DateTime.now().millisecondsSinceEpoch}';

    await db.transaction(() async {
      await db.into(db.pettyCashOpexTable).insert(
        PettyCashOpexCompanion.insert(
          id: id,
          voucherNumber: voucherNumber,
          category: req.category,
          description: req.description,
          amountRupiah: req.amountRupiah,
          expenseDate: now,
          paidByUserId: req.paidByUserId,
          receiptPhotoQueueId: Value(req.receiptPhotoQueueId),
          createdAt: Value(now),
        ),
      );

      await db.into(db.syncOutboxTable).insert(
        SyncOutboxCompanion.insert(
          id: 'OUTBOX_$id',
          targetTable: 'petty_cash_opex',
          recordId: id,
          mutationType: 'INSERT',
          payload: jsonEncode({
            'id': id,
            'voucherNumber': voucherNumber,
            'category': req.category,
            'description': req.description,
            'amountRupiah': req.amountRupiah.toString(),
            'paidByUserId': req.paidByUserId,
            'expenseDate': now.toIso8601String(),
          }),
          status: const Value('PENDING'),
          createdAt: Value(now),
        ),
      );
    });

    return (db.select(db.pettyCashOpexTable)..where((tbl) => tbl.id.equals(id))).getSingle();
  }

  /// Menghitung total OPEX pada rentang tanggal tertentu
  Future<BigInt> getTotalOpexBetween(DateTime start, DateTime end) async {
    final expenses = await (db.select(db.pettyCashOpexTable)
          ..where((tbl) => tbl.expenseDate.isBiggerOrEqualValue(start) & tbl.expenseDate.isSmallerOrEqualValue(end)))
        .get();

    BigInt total = BigInt.zero;
    for (final exp in expenses) {
      total += exp.amountRupiah;
    }
    return total;
  }
}
