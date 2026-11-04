import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// MOD-14 & MOD-15: Dashboard Owner & Resolusi Konflik Stok Offline (Modern B2B SaaS)
class ConflictResolutionScreen extends ConsumerStatefulWidget {
  const ConflictResolutionScreen({super.key});

  @override
  ConsumerState<ConflictResolutionScreen> createState() => _ConflictResolutionScreenState();
}

class _ConflictResolutionScreenState extends ConsumerState<ConflictResolutionScreen> {
  final List<Map<String, dynamic>> _conflictCases = [
    {
      'id': 'CONF_001',
      'invoice': 'INV-HP03-261102-0014',
      'sales': 'Sales Banten 1 (HP03)',
      'product': 'Ribeye Meltique AUS (Primal)',
      'requestedGram': 12000,
      'availableGram': 5000,
      'deficitGram': 7000,
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
      SnackBar(
        content: Text('Kasus $id berhasil diproses: $action'),
        backgroundColor: const Color(0xFF10B981),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    const primaryNavy = Color(0xFF0F172A);
    const cardBorder = Color(0xFFE2E8F0);
    const slateMuted = Color(0xFF64748B);
    const accentAmber = Color(0xFFF59E0B);
    const alertRose = Color(0xFFEF4444);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Resolusi Konflik Stok Offline', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // KPI Row
            Row(
              children: [
                _buildKpiCard('Kasus Tertunda', '2 Kasus', accentAmber, Icons.pending_actions),
                const SizedBox(width: 12),
                _buildKpiCard('Defisit Stok', '13.0 KG', alertRose, Icons.warning_amber),
                const SizedBox(width: 12),
                _buildKpiCard('Integritas Ledger', '100% Valid', const Color(0xFF10B981), Icons.verified),
              ],
            ),

            const SizedBox(height: 20),

            const Text(
              'Daftar Transaksi Offline Berselisih',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: primaryNavy),
            ),
            const SizedBox(height: 4),
            const Text(
              'Terjadi saat dua sales menerbitkan faktur offline melebihi sisa lot fisik di cold storage.',
              style: TextStyle(fontSize: 12, color: slateMuted),
            ),

            const SizedBox(height: 12),

            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _conflictCases.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, i) {
                final c = _conflictCases[i];
                final isResolved = c['status'] != 'PENDING';

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
                                  c['invoice'] as String,
                                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: primaryNavy),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(c['sales'] as String, style: const TextStyle(fontSize: 12, color: slateMuted)),
                            ],
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: isResolved ? const Color(0xFFF0FDF4) : const Color(0xFFFEF3C7),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              c['status'] as String,
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
                        c['product'] as String,
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: primaryNavy),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Diminta: ${(c['requestedGram'] as int)/1000} kg • Tersedia: ${(c['availableGram'] as int)/1000} kg • Defisit: ${(c['deficitGram'] as int)/1000} kg',
                        style: const TextStyle(fontSize: 12, color: alertRose, fontWeight: FontWeight.w600),
                      ),
                      if (!isResolved) ...[
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton(
                                onPressed: () => _resolveCase(c['id'] as String, 'SUBSTITUSI_LOT'),
                                style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(36)),
                                child: const Text('Substitusi Lot Lain', style: TextStyle(fontSize: 12)),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: ElevatedButton(
                                onPressed: () => _resolveCase(c['id'] as String, 'ALOKASI_PARSIAL'),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: primaryNavy,
                                  minimumSize: const Size.fromHeight(36),
                                ),
                                child: const Text('Kirim Parsial', style: TextStyle(fontSize: 12)),
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
