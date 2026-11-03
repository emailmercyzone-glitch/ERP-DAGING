import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// MOD-07: Layanan UI Persediaan Gudang Pusat, Sortir FEFO, & Konversi Potong (Yield Loss)
class FefoWarehouseScreen extends ConsumerStatefulWidget {
  const FefoWarehouseScreen({super.key});

  @override
  ConsumerState<FefoWarehouseScreen> createState() => _FefoWarehouseScreenState();
}

class _FefoWarehouseScreenState extends ConsumerState<FefoWarehouseScreen> {
  // Batch Lots Aktif
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
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('GUDANG PUSAT & FEFO BATCH', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: const Icon(Icons.transform_outlined, color: Color(0xFFF87171)),
            tooltip: 'Konversi Potong (Trimming -> Tetelan)',
            onPressed: () => _showConversionDialog(context),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Banner Aturan FEFO
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF334155)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.access_time_rounded, color: Color(0xFFFBBF24)),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Prinsip FEFO Aktif: Batch dengan masa kedaluwarsa terdekat otomatis dialokasikan terlebih dahulu saat checkout POS.',
                      style: TextStyle(color: Colors.white70, fontSize: 12),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Daftar Lots
            Expanded(
              child: ListView.separated(
                itemCount: _lots.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (context, index) {
                  final lot = _lots[index];
                  final isPriority = lot['status'] == 'FEFO_PRIORITY';
                  return Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: isPriority ? const Color(0xFFEF4444) : const Color(0xFF334155)),
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: isPriority ? const Color(0xFFEF4444).withOpacity(0.2) : const Color(0xFF334155),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Icon(Icons.inventory_2_outlined, color: isPriority ? const Color(0xFFEF4444) : Colors.white60),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Text(lot['lotCode'], style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                                  const SizedBox(width: 8),
                                  if (isPriority)
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(color: const Color(0xFFDC2626), borderRadius: BorderRadius.circular(4)),
                                      child: const Text('PRIORITAS FEFO', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
                                    ),
                                ],
                              ),
                              Text('${lot['productName']} • Lokasi: ${lot['location']}', style: const TextStyle(color: Colors.white60, fontSize: 11)),
                              Text('HPP: Rp ${lot['hppPerGram']} / gram (Rp ${(lot['hppPerGram'] * 1000)} / kg)', style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 11)),
                            ],
                          ),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text('${(lot['currentWeightGram'] / 1000).toStringAsFixed(2)} KG', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
                            Text('${lot['daysLeft']} hari lagi (${lot['expiryDate']})',
                                style: TextStyle(
                                  color: lot['daysLeft'] <= 14 ? const Color(0xFFF87171) : const Color(0xFF4ADE80),
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                )),
                          ],
                        ),
                      ],
                    ),
                  );
                },
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
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('Konversi Trimming ke Tetelan (BR-051)', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold)),
        content: const Text(
          'Pemotongan daging primal 10 kg menjadi:\n• Tetelan Masuk (IN_CONVERSION): 8.5 kg\n• Susut Lemak (OUT_CUTTING_LOSS): 1.5 kg\nHPP tetelan akan otomatis menyerap modal bahan baku asal.',
          style: TextStyle(color: Colors.white70, fontSize: 12),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Batal', style: TextStyle(color: Colors.white54))),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Konversi potong berhasil dicatat ke stock_ledger!')),
              );
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
            child: const Text('Eksekusi Konversi', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }
}
