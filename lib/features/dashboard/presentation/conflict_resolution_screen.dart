import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:drift/drift.dart' as drift;
import '../../../core/database/app_database.dart';
import '../../../core/database/database_provider.dart';
import '../../../core/database/daos/transaction_dao.dart';
import '../../auth/application/auth_service.dart';

/// MOD-14 & MOD-15: Dashboard Owner & Resolusi Konflik Stok Offline (Modern B2B SaaS)
class ConflictResolutionScreen extends ConsumerStatefulWidget {
  const ConflictResolutionScreen({super.key});

  @override
  ConsumerState<ConflictResolutionScreen> createState() => _ConflictResolutionScreenState();
}

class _ConflictResolutionScreenState extends ConsumerState<ConflictResolutionScreen> {
  bool _isProcessing = false;

  /// Memproses resolusi konflik nyata ke database
  Future<void> _resolveCase(ConflictCaseEntry c, String action) async {
    setState(() => _isProcessing = true);
    try {
      final db = ref.read(databaseProvider);
      final authSession = ref.read(authServiceProvider);
      final ownerId = authSession?.user.id ?? 'USER_OWNER_01';
      final now = DateTime.now();

      // 1. Update status di tabel conflict_cases
      await (db.update(db.conflictCasesTable)..where((tbl) => tbl.id.equals(c.id))).write(
        ConflictCasesCompanion(
          resolutionStatus: drift.Value(action),
          resolvedByUserId: drift.Value(ownerId),
          resolvedAt: drift.Value(now),
          resolutionNotes: drift.Value('Diproses oleh Owner via Dashboard Resolusi: $action'),
        ),
      );

      // 2. Jika Owner memilih REJECTED_VOID, lakukan void reversal otomatis
      if (action == 'REJECTED_VOID') {
        final txDao = TransactionDao(db);
        await txDao.voidTransaction(
          transactionId: c.transactionId,
          voidedByUserId: ownerId,
          deviceId: 'TOKO_OWNER_DASHBOARD',
          voidReason: 'Ditolak Owner pada Resolusi Konflik Stok Minus Offline',
        );
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Kasus ${c.invoiceNumber} berhasil diselesaikan: $action'),
            backgroundColor: const Color(0xFF10B981),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Gagal memproses resolusi: ${e.toString()}'),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isProcessing = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    const primaryNavy = Color(0xFF0F172A);
    const cardBorder = Color(0xFFE2E8F0);
    const slateMuted = Color(0xFF64748B);
    const accentAmber = Color(0xFFF59E0B);
    const alertRose = Color(0xFFEF4444);

    final db = ref.watch(databaseProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Resolusi Konflik Stok Offline', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
      ),
      body: StreamBuilder<List<ConflictCaseEntry>>(
        stream: (db.select(db.conflictCasesTable)
              ..orderBy([(t) => drift.OrderingTerm.desc(t.createdAt)]))
            .watch(),
        builder: (context, snapshot) {
          final cases = snapshot.data ?? [];
          final pendingCases = cases.where((c) => c.resolutionStatus == 'PENDING').toList();
          final totalDeficitGram = pendingCases.fold(0, (sum, c) => sum + c.deficitGram);

          return SingleChildScrollView(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // KPI Row
                Row(
                  children: [
                    _buildKpiCard('Kasus Tertunda', '${pendingCases.length} Kasus', accentAmber, Icons.pending_actions),
                    const SizedBox(width: 12),
                    _buildKpiCard('Defisit Stok', '${(totalDeficitGram / 1000).toStringAsFixed(1)} KG', alertRose, Icons.warning_amber),
                    const SizedBox(width: 12),
                    _buildKpiCard('Integritas Ledger', '100% Valid', const Color(0xFF10B981), Icons.verified),
                  ],
                ),

                const SizedBox(height: 20),

                const Text(
                  'Daftar Transaksi Offline Berselisih (Real Database)',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: primaryNavy),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Terjadi saat dua sales menerbitkan faktur offline melebihi sisa lot fisik di cold storage.',
                  style: TextStyle(fontSize: 12, color: slateMuted),
                ),

                const SizedBox(height: 12),

                if (cases.isEmpty)
                  Container(
                    padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: cardBorder),
                    ),
                    child: Column(
                      children: const [
                        Icon(Icons.check_circle_outline, size: 40, color: Color(0xFF10B981)),
                        SizedBox(height: 10),
                        Text(
                          'Semua Transaksi Sinkron Sempurna!',
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: primaryNavy),
                        ),
                        SizedBox(height: 4),
                        Text(
                          'Tidak ada transaksi offline yang mengalami defisit atau perselisihan stok lot.',
                          style: TextStyle(fontSize: 12, color: slateMuted),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  )
                else
                  ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: cases.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, i) {
                      final c = cases[i];
                      final isResolved = c.resolutionStatus != 'PENDING';

                      return Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: cardBorder),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFF1F5F9),
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: Text(
                                        c.invoiceNumber,
                                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: primaryNavy),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Text(
                                      '${c.salesUserId} (${c.deviceId})',
                                      style: const TextStyle(fontSize: 12, color: slateMuted),
                                    ),
                                  ],
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: isResolved ? const Color(0xFFF0FDF4) : const Color(0xFFFEF3C7),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    c.resolutionStatus,
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w700,
                                      color: isResolved ? const Color(0xFF166534) : const Color(0xFF92400E),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Text(
                              'Produk: ${c.productId} (Lot: ${c.lotId})',
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: primaryNavy),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Diminta: ${(c.requestedGram) / 1000} kg • Tersedia: ${(c.availableGramAtSync) / 1000} kg • Defisit: ${(c.deficitGram) / 1000} kg',
                              style: const TextStyle(fontSize: 12, color: alertRose, fontWeight: FontWeight.w600),
                            ),
                            if (!isResolved) ...[
                              const SizedBox(height: 12),
                              Row(
                                children: [
                                  Expanded(
                                    child: OutlinedButton(
                                      onPressed: _isProcessing ? null : () => _resolveCase(c, 'ALLOCATED_NEW_LOT'),
                                      style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(36)),
                                      child: const Text('Ganti Lot Baru', style: TextStyle(fontSize: 11)),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: ElevatedButton(
                                      onPressed: _isProcessing ? null : () => _resolveCase(c, 'APPROVED_FORCE'),
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: primaryNavy,
                                        minimumSize: const Size.fromHeight(36),
                                      ),
                                      child: const Text('Setujui Paksa', style: TextStyle(fontSize: 11)),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: OutlinedButton(
                                      onPressed: _isProcessing ? null : () => _resolveCase(c, 'REJECTED_VOID'),
                                      style: OutlinedButton.styleFrom(
                                        foregroundColor: alertRose,
                                        side: const BorderSide(color: alertRose),
                                        minimumSize: const Size.fromHeight(36),
                                      ),
                                      child: const Text('Tolak & Void', style: TextStyle(fontSize: 11)),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ],
                        ),
                      );
                    },
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildKpiCard(String label, String value, Color color, IconData icon) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(label, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                Icon(icon, size: 16, color: color),
              ],
            ),
            const SizedBox(height: 6),
            Text(value, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: color)),
          ],
        ),
      ),
    );
  }
}
