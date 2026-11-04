import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// MOD-07: Layanan UI Persediaan Gudang Pusat, Sortir FEFO, & Konversi Potong (Modern B2B SaaS)
class FefoWarehouseScreen extends ConsumerStatefulWidget {
  const FefoWarehouseScreen({super.key});

  @override
  ConsumerState<FefoWarehouseScreen> createState() => _FefoWarehouseScreenState();
}

class _FefoWarehouseScreenState extends ConsumerState<FefoWarehouseScreen> {
  final List<Map<String, dynamic>> _lots = [
    {
      'lotCode': 'LOT-AUS-261015-01',
      'productName': 'Ribeye Meltique AUS (Primal)',
      'expiryDate': '2026-11-15',
      'daysLeft': 13,
      'currentWeightGram': 48500, // 48.5 kg
      'hppPerGram': 180, // Rp 180.000 / kg
      'location': 'FREEZER-A-01',
      'status': 'FEFO_PRIORITY',
    },
    {
      'lotCode': 'LOT-USA-261028-02',
      'productName': 'Sirloin Choice USA (Primal)',
      'expiryDate': '2026-12-01',
      'daysLeft': 29,
      'currentWeightGram': 82000, // 82 kg
      'hppPerGram': 165,
      'location': 'FREEZER-A-02',
      'status': 'NORMAL',
    },
    {
      'lotCode': 'LOT-TET-261030-01',
      'productName': 'Tetelan Rawon Super (Konversi)',
      'expiryDate': '2026-11-20',
      'daysLeft': 18,
      'currentWeightGram': 24000,
      'hppPerGram': 65,
      'location': 'FREEZER-B-01',
      'status': 'NORMAL',
    },
  ];

  @override
  Widget build(BuildContext context) {
    const primaryNavy = Color(0xFF0F172A);
    const cardBorder = Color(0xFFE2E8F0);
    const slateMuted = Color(0xFF64748B);
    const accentEmerald = Color(0xFF10B981);
    const accentAmber = Color(0xFFF59E0B);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Gudang & Batch FEFO', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
        actions: [
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: OutlinedButton.icon(
              onPressed: () => _showConversionDialog(context),
              icon: const Icon(Icons.content_cut, size: 14),
              label: const Text('Konversi Potong', style: TextStyle(fontSize: 12)),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(120, 36),
                padding: const EdgeInsets.symmetric(horizontal: 12),
              ),
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Ledger Protected Banner
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFF0FDF4),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFBBF7D0)),
              ),
              child: Row(
                children: const [
                  Icon(Icons.shield_outlined, size: 18, color: accentEmerald),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Aturan FEFO Aktif • Ledger Terproteksi Trigger SQLite (Zero Floating-Point)',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF166534)),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // High-density Batch Lots Table
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: cardBorder),
              ),
              child: Column(
                children: [
                  // Table Header
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: const BoxDecoration(
                      color: Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.only(
                        topLeft: Radius.circular(12),
                        topRight: Radius.circular(12),
                      ),
                      border: Border(bottom: BorderSide(color: cardBorder)),
                    ),
                    child: Row(
                      children: const [
                        Expanded(flex: 3, child: Text('BATCH / PRODUK', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: slateMuted))),
                        Expanded(flex: 2, child: Text('EXPIRED', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: slateMuted))),
                        Expanded(flex: 2, child: Text('STOK (GRAM)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: slateMuted))),
                        Expanded(flex: 2, child: Text('STATUS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: slateMuted))),
                      ],
                    ),
                  ),

                  // Table Rows
                  ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: _lots.length,
                    separatorBuilder: (_, __) => const Divider(height: 1, color: cardBorder),
                    itemBuilder: (context, i) {
                      final lot = _lots[i];
                      final isFefo = lot['status'] == 'FEFO_PRIORITY';
                      final weightKg = (lot['currentWeightGram'] as int) / 1000.0;

                      return Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        child: Row(
                          children: [
                            Expanded(
                              flex: 3,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    lot['productName'] as String,
                                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: primaryNavy),
                                  ),
                                  Text(
                                    '${lot['lotCode']} • ${lot['location']}',
                                    style: const TextStyle(fontSize: 11, color: slateMuted),
                                  ),
                                ],
                              ),
                            ),
                            Expanded(
                              flex: 2,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    lot['expiryDate'] as String,
                                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: primaryNavy),
                                  ),
                                  Text(
                                    '${lot['daysLeft']} hari lagi',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      color: isFefo ? const Color(0xFFEF4444) : slateMuted,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Expanded(
                              flex: 2,
                              child: Text(
                                '${weightKg.toStringAsFixed(1)} kg\n(${lot['currentWeightGram']} g)',
                                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: primaryNavy),
                              ),
                            ),
                            Expanded(
                              flex: 2,
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: isFefo ? const Color(0xFFFEF3C7) : const Color(0xFFF1F5F9),
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(
                                    color: isFefo ? const Color(0xFFFDE68A) : const Color(0xFFE2E8F0),
                                  ),
                                ),
                                child: Text(
                                  isFefo ? 'FEFO PRIORITAS' : 'NORMAL',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    color: isFefo ? const Color(0xFF92400E) : slateMuted,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showConversionDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        title: const Text('Konversi Trimming Daging', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
        content: const Text(
          'Konversi 10.000 gram primal menjadi 8.500 gram tetelan dengan susut 1.500 gram yield loss tercatat ke stock_ledger.',
          style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Batal')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0F172A)),
            child: const Text('Proses Konversi'),
          ),
        ],
      ),
    );
  }
}
