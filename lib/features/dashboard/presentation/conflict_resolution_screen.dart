import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// MOD-14 & MOD-15: Dashboard Owner, Indikator Kesehatan Toko 3-Detik, & Resolusi Konflik Stok Minus
class ConflictResolutionScreen extends ConsumerStatefulWidget {
  const ConflictResolutionScreen({super.key});

  @override
  ConsumerState<ConflictResolutionScreen> createState() => _ConflictResolutionScreenState();
}

class _ConflictResolutionScreenState extends ConsumerState<ConflictResolutionScreen> {
  // Data Kasus Bentrok Stok Offline
  final List<Map<String, dynamic>> _conflictCases = [
    {
      'id': 'CONF_001',
      'invoice': 'INV-HP03-261102-0014',
      'sales': 'Sales Banten 1 (HP03)',
      'product': 'Ribeye Meltique AUS (Primal)',
      'requestedGram': 12000, // Sales minta 12 kg
      'availableGram': 5000,  // Di gudang cuma ada 5 kg
      'deficitGram': 7000,    // Defisit 7 kg
      'status': 'PENDING',
    },
    {
      'id': 'CONF_002',
      'invoice': 'INV-HP05-261102-0008',
      'sales': 'Sales Tangsel (HP05)',
      'product': 'Sirloin Choice USA (Primal)',
      'requestedGram': 8000,
      'availableGram': 2000,
      'deficitGram': 6000,
      'status': 'PENDING',
    },
  ];

  void _resolveCase(String id, String action) {
    setState(() {
      final index = _conflictCases.indexWhere((c) => c['id'] == id);
      if (index != -1) {
        _conflictCases[index]['status'] = action;
      }
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Kasus $id berhasil diselesaikan ($action) oleh Owner!')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('OWNER DASHBOARD & KONFLIK', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // MOD-14: Store Health Score (Indikator Sehat 3-Detik)
            const Text('Indikator Kesehatan Toko 3-Detik (MOD-14)', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
            const SizedBox(height: 12),
            Row(
              children: [
                _buildHealthCard('Kas Lapangan', 'Rp 3.85jt', 'Soft Limit Alert', const Color(0xFFFBBF24), Icons.warning_amber_rounded),
                const SizedBox(width: 12),
                _buildHealthCard('Piutang Tempo', 'Rp 16.9jt', 'Lampu Hijau (Aman)', const Color(0xFF4ADE80), Icons.check_circle_outline),
                const SizedBox(width: 12),
                _buildHealthCard('Stok Kritis', '2 Kasus', 'Perlu Resolusi', const Color(0xFFF87171), Icons.error_outline),
              ],
            ),
            const SizedBox(height: 24),

            // MOD-15: Conflict Resolution Panel
            Row(
              mainAxisAlignment: MainAxisAlignment.between,
              children: [
                const Text('Resolusi Konflik Stok Minus Offline (MOD-15)', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: const Color(0xFFDC2626), borderRadius: BorderRadius.circular(6)),
                  child: Text('${_conflictCases.where((c) => c['status'] == 'PENDING').length} Kasus Pending', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
            const SizedBox(height: 12),

            ..._conflictCases.map((c) {
              final isPending = c['status'] == 'PENDING';
              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: isPending ? const Color(0xFFEF4444) : const Color(0xFF334155)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.between,
                      children: [
                        Text(c['invoice'], style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: isPending ? const Color(0xFF7F1D1D) : const Color(0xFF14532D),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            c['status'],
                            style: TextStyle(color: isPending ? const Color(0xFFFCA5A5) : const Color(0xFF86EFAC), fontSize: 10, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text('Aktor: ${c['sales']} • Produk: ${c['product']}', style: const TextStyle(color: Colors.white70, fontSize: 12)),
                    const SizedBox(height: 8),

                    // Detail Timbangan Selisih
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(color: const Color(0xFF0F172A), borderRadius: BorderRadius.circular(8)),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          _buildStatColumn('Diminta Sales', '${(c['requestedGram'] / 1000).toStringAsFixed(1)} kg'),
                          _buildStatColumn('Fisik Tersedia', '${(c['availableGram'] / 1000).toStringAsFixed(1)} kg'),
                          _buildStatColumn('Defisit Minus', '-${(c['deficitGram'] / 1000).toStringAsFixed(1)} kg', isRed: true),
                        ],
                      ),
                    ),

                    if (isPending) ...[
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          OutlinedButton(
                            onPressed: () => _resolveCase(c['id'], 'VOID_TRANSACTION'),
                            style: OutlinedButton.styleFrom(foregroundColor: const Color(0xFFF87171)),
                            child: const Text('Batalkan (Void)'),
                          ),
                          const SizedBox(width: 8),
                          ElevatedButton(
                            onPressed: () => _resolveCase(c['id'], 'APPROVED_FORCE'),
                            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626), foregroundColor: Colors.white),
                            child: const Text('Setujui Paksa (Stok Ada)'),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              );
            }).toList(),
          ],
        ),
      ),
    );
  }

  Widget _buildHealthCard(String title, String value, String sub, Color color, IconData icon) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0xFF1E293B),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withOpacity(0.4)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.between,
              children: [
                Text(title, style: const TextStyle(color: Colors.white60, fontSize: 11)),
                Icon(icon, color: color, size: 18),
              ],
            ),
            const SizedBox(height: 8),
            Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18)),
            const SizedBox(height: 2),
            Text(sub, style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }

  Widget _buildStatColumn(String label, String value, {bool isRed = false}) {
    return Column(
      children: [
        Text(label, style: const TextStyle(color: Colors.white54, fontSize: 10)),
        const SizedBox(height: 2),
        Text(value, style: TextStyle(color: isRed ? const Color(0xFFF87171) : Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
      ],
    );
  }
}
