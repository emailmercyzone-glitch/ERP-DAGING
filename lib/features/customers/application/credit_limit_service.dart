import 'package:drift/drift.dart';
import '../../../core/database/app_database.dart';

/// Hasil Evaluasi Plafon Piutang Pelanggan
class CreditLimitCheckResult {
  final bool isApproved;
  final bool isBlocked;
  final bool requiresOwnerApproval;
  final String? warningMessage;
  final BigInt currentReceivableRupiah;
  final BigInt creditLimitRupiah;
  final BigInt projectedReceivableRupiah;
  final bool hasOverdueInvoices;

  CreditLimitCheckResult({
    required this.isApproved,
    required this.isBlocked,
    required this.requiresOwnerApproval,
    this.warningMessage,
    required this.currentReceivableRupiah,
    required this.creditLimitRupiah,
    required this.projectedReceivableRupiah,
    required this.hasOverdueInvoices,
  });
}

/// MOD-06 & MOD-10: Layanan Plafon Piutang, Aging Buckets, & Warning Lampu Kuning
class CreditLimitService {
  final AppDatabase db;

  CreditLimitService(this.db);

  /// Validasi apakah pelanggan dapat mengambil order dengan metode pembayaran TEMPO
  Future<CreditLimitCheckResult> evaluateCustomerCredit({
    required String customerId,
    required BigInt newInvoiceAmountRupiah,
  }) async {
    final customer = await (db.select(db.customersTable)..where((tbl) => tbl.id.equals(customerId))).getSingle();
    final now = DateTime.now();

    // 1. Cek apakah ada invoice tempo yang sudah melewati jatuh tempo (Overdue / Lampu Kuning)
    final overdueInvoices = await (db.select(db.transactionsTable)
          ..where((tbl) => 
              tbl.customerId.equals(customerId) & 
              tbl.paymentMethod.equals('TEMPO') & 
              tbl.balanceDueRupiah.isBiggerThanValue(BigInt.zero) & 
              tbl.dueDate.isSmallerThanValue(now) &
              tbl.status.isNotValue('VOID')))
        .get();

    final hasOverdue = overdueInvoices.isNotEmpty;

    // 2. Hitung proyeksi piutang jika order ini disetujui
    final currentReceivable = customer.currentReceivableRupiah;
    final creditLimit = customer.creditLimitRupiah;
    final projected = currentReceivable + newInvoiceAmountRupiah;

    // Pelanggan dengan limit 0 berarti strictly CASH ONLY (kecuali diizinkan Owner)
    if (creditLimit == BigInt.zero) {
      return CreditLimitCheckResult(
        isApproved: false,
        isBlocked: true,
        requiresOwnerApproval: true,
        warningMessage: 'Pelanggan ini berstatus Cash Only (Plafon Rp 0). Memerlukan PIN Owner untuk tempo.',
        currentReceivableRupiah: currentReceivable,
        creditLimitRupiah: creditLimit,
        projectedReceivableRupiah: projected,
        hasOverdueInvoices: hasOverdue,
      );
    }

    // Cek apakah melewati limit
    final isOverLimit = projected > creditLimit;

    if (hasOverdue || isOverLimit) {
      String reason = '';
      if (hasOverdue && isOverLimit) {
        reason = 'Plafon terlampaui (+Rp ${(projected - creditLimit).toString()}) dan ada faktur jatuh tempo menunggak!';
      } else if (hasOverdue) {
        reason = 'Terdapat ${overdueInvoices.length} faktur tempo yang telah melewati jatuh tempo (Lampu Kuning)!';
      } else {
        reason = 'Melebihi batas plafon piutang maksimal Rp ${creditLimit.toString()}!';
      }

      return CreditLimitCheckResult(
        isApproved: false,
        isBlocked: true,
        requiresOwnerApproval: true,
        warningMessage: reason,
        currentReceivableRupiah: currentReceivable,
        creditLimitRupiah: creditLimit,
        projectedReceivableRupiah: projected,
        hasOverdueInvoices: hasOverdue,
      );
    }

    // Lolos verifikasi
    return CreditLimitCheckResult(
      isApproved: true,
      isBlocked: false,
      requiresOwnerApproval: false,
      warningMessage: null,
      currentReceivableRupiah: currentReceivable,
      creditLimitRupiah: creditLimit,
      projectedReceivableRupiah: projected,
      hasOverdueInvoices: false,
    );
  }

  /// Menambah saldo piutang pelanggan saat invoice TEMPO terbit
  Future<void> addReceivable({
    required String customerId,
    required BigInt amountRupiah,
  }) async {
    final customer = await (db.select(db.customersTable)..where((tbl) => tbl.id.equals(customerId))).getSingle();
    final updated = customer.currentReceivableRupiah + amountRupiah;
    await (db.update(db.customersTable)..where((tbl) => tbl.id.equals(customerId))).write(
      CustomersCompanion(currentReceivableRupiah: Value(updated), updatedAt: Value(DateTime.now())),
    );
  }

  /// Mengurangi saldo piutang saat pelanggan melakukan pembayaran
  Future<void> reduceReceivable({
    required String customerId,
    required BigInt amountPaidRupiah,
  }) async {
    final customer = await (db.select(db.customersTable)..where((tbl) => tbl.id.equals(customerId))).getSingle();
    final updated = customer.currentReceivableRupiah - amountPaidRupiah;
    await (db.update(db.customersTable)..where((tbl) => tbl.id.equals(customerId))).write(
      CustomersCompanion(
        currentReceivableRupiah: Value(updated < BigInt.zero ? BigInt.zero : updated),
        updatedAt: Value(DateTime.now()),
      ),
    );
  }
}
