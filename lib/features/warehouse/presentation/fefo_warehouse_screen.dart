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
      'maxCapacityGram': 60000, // 60 kg shelf max -> Tier 2 (Ideal)
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
      'maxCapacityGram': 90000, // 90 kg shelf max -> Tier 3 (Penuh)
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
      'maxCapacityGram': 60000, // 60 kg shelf max -> Tier 1 (Ringan)
      'hppPerGram': 65,
      'location': 'FREEZER-B-01',
      'status': 'NORMAL',
    },
  ];

  String _searchQuery = '';

  List<Map<String, dynamic>> get _filteredLots {
    if (_searchQuery.trim().isEmpty) return _lots;
    final q = _searchQuery.toLowerCase().trim();
    return _lots.where((lot) {
      final productName = (lot['productName'] as String).toLowerCase();
      final lotCode = (lot['lotCode'] as String).toLowerCase();
      final location = (lot['location'] as String).toLowerCase();
      return productName.contains(q) || lotCode.contains(q) || location.contains(q);
    }).toList();
  }

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
            margin: const EdgeInsets.symmetric(horizontal: 2, vertical: 8),
            child: ElevatedButton.icon(
              onPressed: () => _showScanQrDialog(context),
              icon: const Icon(Icons.qr_code_scanner, size: 14, color: Colors.white),
              label: const Text('Scan QR', style: TextStyle(fontSize: 12, color: Colors.white, fontWeight: FontWeight.w600)),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF4F46E5),
                minimumSize: const Size(96, 36),
                padding: const EdgeInsets.symmetric(horizontal: 8),
              ),
            ),
          ),
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 2, vertical: 8),
            child: OutlinedButton.icon(
              onPressed: () => _exportBatchCsv(context),
              icon: const Icon(Icons.download, size: 14, color: accentEmerald),
              label: const Text('Export CSV', style: TextStyle(fontSize: 12, color: accentEmerald, fontWeight: FontWeight.w600)),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: accentEmerald),
                minimumSize: const Size(100, 36),
                padding: const EdgeInsets.symmetric(horizontal: 8),
              ),
            ),
          ),
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
            child: OutlinedButton.icon(
              onPressed: () => _showConversionDialog(context),
              icon: const Icon(Icons.content_cut, size: 14),
              label: const Text('Konversi', style: TextStyle(fontSize: 12)),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(90, 36),
                padding: const EdgeInsets.symmetric(horizontal: 8),
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

            // Search Input Bar with QR Scanner Trigger
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: cardBorder),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
              child: Row(
                children: [
                  const Icon(Icons.search, size: 18, color: slateMuted),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      onChanged: (val) {
                        setState(() {
                          _searchQuery = val;
                        });
                      },
                      style: const TextStyle(fontSize: 12, color: primaryNavy),
                      decoration: const InputDecoration(
                        hintText: 'Cari potongan daging, kode batch, atau freezer...',
                        hintStyle: TextStyle(fontSize: 12, color: slateMuted),
                        border: InputBorder.none,
                        isDense: true,
                        contentPadding: EdgeInsets.symmetric(vertical: 10),
                      ),
                    ),
                  ),
                  if (_searchQuery.isNotEmpty)
                    GestureDetector(
                      onTap: () {
                        setState(() {
                          _searchQuery = '';
                        });
                      },
                      child: const Icon(Icons.close, size: 16, color: slateMuted),
                    ),
                  const SizedBox(width: 4),
                  InkWell(
                    onTap: () => _showScanQrDialog(context),
                    borderRadius: BorderRadius.circular(6),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEEF2FF),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: const Color(0xFFC7D2FE)),
                      ),
                      child: Row(
                        children: const [
                          Icon(Icons.qr_code_scanner, size: 14, color: Color(0xFF4F46E5)),
                          SizedBox(width: 4),
                          Text('Scan QR', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF4F46E5))),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),


            const SizedBox(height: 12),

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

                  // Table Rows or Empty State
                  if (_filteredLots.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 16),
                      child: Column(
                        children: [
                          const Icon(Icons.search_off, size: 36, color: slateMuted),
                          const SizedBox(height: 8),
                          Text(
                            'Tidak ada batch yang cocok dengan "$_searchQuery"',
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: slateMuted),
                          ),
                          const SizedBox(height: 4),
                          TextButton(
                            onPressed: () {
                              setState(() {
                                _searchQuery = '';
                              });
                            },
                            child: const Text('Reset Pencarian', style: TextStyle(fontSize: 11)),
                          ),
                        ],
                      ),
                    )
                  else
                    ListView.separated(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: _filteredLots.length,
                      separatorBuilder: (_, __) => const Divider(height: 1, color: cardBorder),
                      itemBuilder: (context, i) {
                        final lot = _filteredLots[i];
                        final isFefo = lot['status'] == 'FEFO_PRIORITY';
                        final weightKg = (lot['currentWeightGram'] as int) / 1000.0;
                        final maxCapacityGram = (lot['maxCapacityGram'] as int?) ?? 60000;
                        final densityPercent = (((lot['currentWeightGram'] as int) / maxCapacityGram) * 100).clamp(0, 100).round();
                        final maxKg = (maxCapacityGram / 1000.0).toStringAsFixed(1);

                        final Color tierColor = densityPercent < 50
                            ? const Color(0xFF10B981) // Tier 1: Emerald (<50%)
                            : densityPercent <= 85
                                ? const Color(0xFFF59E0B) // Tier 2: Amber (50-85%)
                                : const Color(0xFFEF4444); // Tier 3: Rose (>85%)

                        final String tierLabel = densityPercent < 50
                            ? 'Tier 1: Ringan (<50%)'
                            : densityPercent <= 85
                                ? 'Tier 2: Ideal (50-85%)'
                                : 'Tier 3: Kritis / Penuh (>85%)';

                        return Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
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
                              const SizedBox(height: 8),
                              // 3-Tier Stock Density Visual Bar
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF8FAFC),
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(color: const Color(0xFFF1F5F9)),
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
                                              width: 6,
                                              height: 6,
                                              decoration: BoxDecoration(
                                                color: tierColor,
                                                shape: BoxShape.circle,
                                              ),
                                            ),
                                            const SizedBox(width: 6),
                                            Text(
                                              'Stock Density: $densityPercent% • $tierLabel',
                                              style: TextStyle(
                                                fontSize: 10,
                                                fontWeight: FontWeight.w700,
                                                color: tierColor,
                                              ),
                                            ),
                                          ],
                                        ),
                                        Text(
                                          '${weightKg.toStringAsFixed(1)} / $maxKg kg kapasitas rak',
                                          style: const TextStyle(
                                            fontSize: 10,
                                            fontWeight: FontWeight.w600,
                                            color: slateMuted,
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 4),
                                    TweenAnimationBuilder<double>(
                                      duration: const Duration(milliseconds: 650),
                                      curve: Curves.easeOutCubic,
                                      tween: Tween<double>(begin: 0, end: densityPercent / 100.0),
                                      builder: (context, animValue, _) {
                                        return ClipRRect(
                                          borderRadius: BorderRadius.circular(3),
                                          child: LinearProgressIndicator(
                                            value: animValue,
                                            backgroundColor: const Color(0xFFE2E8F0),
                                            valueColor: AlwaysStoppedAnimation<Color>(tierColor),
                                            minHeight: 5,
                                          ),
                                        );
                                      },
                                    ),
                                  ],
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

  void _exportBatchCsv(BuildContext context) {
    // Generate CSV string representation of _lots
    final buffer = StringBuffer();
    buffer.writeln('Kode_Batch,Nama_Produk,Lokasi,Expired,Sisa_Hari,Stok_Gram,HPP_per_Gram,Status');
    for (final lot in _lots) {
      buffer.writeln(
        '${lot['lotCode']},"${lot['productName']}",${lot['location']},${lot['expiryDate']},${lot['daysLeft']},${lot['currentWeightGram']},${lot['hppPerGram']},${lot['status']}',
      );
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: const [
            Icon(Icons.check_circle_outline, color: Colors.white, size: 20),
            SizedBox(width: 10),
            Expanded(
              child: Text(
                'Mantap! Data batch coldroom berhasil diexport ke format CSV untuk kebutuhan audit eksternal.',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
        backgroundColor: const Color(0xFF10B981),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 4),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    );
  }

  void _showScanQrDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: const Color(0xFF0F172A),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: const [
            Icon(Icons.qr_code_scanner, color: Color(0xFF818CF8), size: 20),
            SizedBox(width: 8),
            Text(
              'Pemindai QR Kemasan',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              height: 160,
              width: double.infinity,
              decoration: BoxDecoration(
                color: Colors.black,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF334155)),
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  const Icon(Icons.camera_alt_outlined, size: 48, color: Color(0xFF475569)),
                  Container(
                    width: 110,
                    height: 110,
                    decoration: BoxDecoration(
                      border: Border.all(color: const Color(0xFF10B981), width: 2),
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  Positioned(
                    bottom: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E293B),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Text(
                        'Arahkan kamera ke label karton batch',
                        style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            const Text(
              'Pilih Label untuk Simulasi Scan:',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF94A3B8)),
            ),
            const SizedBox(height: 6),
            ..._lots.map((lot) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: InkWell(
                onTap: () {
                  Navigator.pop(context);
                  setState(() {
                    _searchQuery = lot['lotCode'] as String;
                  });
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Scan Berhasil! Filter batch: ${lot['lotCode']} (${lot['productName']})'),
                      backgroundColor: const Color(0xFF4F46E5),
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                },
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E293B),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFF334155)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            lot['lotCode'] as String,
                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white),
                          ),
                          Text(
                            lot['productName'] as String,
                            style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
                          ),
                        ],
                      ),
                      const Icon(Icons.arrow_forward_ios, size: 12, color: Color(0xFF818CF8)),
                    ],
                  ),
                ),
              ),
            )),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Tutup', style: TextStyle(color: Color(0xFF94A3B8))),
          ),
        ],
      ),
    );
  }
}


