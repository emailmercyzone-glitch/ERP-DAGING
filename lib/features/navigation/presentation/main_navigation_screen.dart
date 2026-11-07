import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../pos/presentation/pos_screen.dart';
import '../../warehouse/presentation/fefo_warehouse_screen.dart';
import '../../dashboard/presentation/conflict_resolution_screen.dart';

/// Navigation Shell Utama dengan GoPay-Style UX & HashMicro ERP Rigor
/// 5 Tab Utama: Home, Kasir, Beli, Stok Barang, Bayar
/// Serta Modal Bottom Sheet "Modul Lainnya" untuk Enterprise Ledger & Pajak
class MainNavigationScreen extends ConsumerStatefulWidget {
  const MainNavigationScreen({super.key});

  @override
  ConsumerState<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends ConsumerState<MainNavigationScreen> {
  int _currentIndex = 0;
  bool _isOnline = true;
  String _receivableFilter = 'ALL'; // 'ALL', 'HARI_INI', 'TERLAMBAT', 'AKAN_DATANG'
  String _receivableSearch = '';

  final List<Map<String, dynamic>> _receivablesData = [
    {
      'id': 'REC_01',
      'customer': 'Hotel Grand Serang',
      'tier': 'HOREKA',
      'amount': 12500000,
      'limit': 25000000,
      'dueDate': '16 Nov 2026 (11 hari lagi)',
      'category': 'LEBIH_7_HARI',
      'daysDiff': 11,
      'invoice': 'INV-HP03-261102-0012',
      'itemsSummary': '50.0 KG Ribeye Meltique AUS, 30.0 KG Tenderloin',
      'phone': '0812-8899-7711',
      'isPaid': false,
    },
    {
      'id': 'REC_02',
      'customer': 'Steakhouse Banten Prima',
      'tier': 'HOREKA',
      'amount': 4400000,
      'limit': 5000000,
      'dueDate': '05 Nov 2026 (Hari Ini)',
      'category': 'HARI_INI',
      'daysDiff': 0,
      'invoice': 'INV-HP03-261028-0089',
      'itemsSummary': '25.0 KG Sirloin Choice USA',
      'phone': '0813-1122-3344',
      'isPaid': false,
    },
    {
      'id': 'REC_03',
      'customer': 'Resto Padang Sederhana Cilegon',
      'tier': 'RESTO',
      'amount': 5800000,
      'limit': 8000000,
      'dueDate': '01 Nov 2026 (Terlambat 4 hari)',
      'category': 'TERLAMBAT',
      'daysDiff': -4,
      'invoice': 'INV-HP03-261018-0044',
      'itemsSummary': '80.0 KG Tetelan Rawon Super',
      'phone': '0819-5566-7788',
      'isPaid': false,
    },
    {
      'id': 'REC_04',
      'customer': 'Dapur Catering Krakatau',
      'tier': 'CATERING',
      'amount': 3200000,
      'limit': 6000000,
      'dueDate': '29 Okt 2026 (Terlambat 7 hari)',
      'category': 'TERLAMBAT',
      'daysDiff': -7,
      'invoice': 'INV-HP03-261015-0031',
      'itemsSummary': '40.0 KG US Beef Shortplate',
      'phone': '0857-4433-2211',
      'isPaid': false,
    },
    {
      'id': 'REC_05',
      'customer': 'Cafe & Grill Anyer Beach',
      'tier': 'HOREKA',
      'amount': 2750000,
      'limit': 4000000,
      'dueDate': '05 Nov 2026 (Hari Ini)',
      'category': 'HARI_INI',
      'daysDiff': 0,
      'invoice': 'INV-HP03-261029-0095',
      'itemsSummary': '15.0 KG Ribeye Meltique AUS',
      'phone': '0812-9988-1122',
      'isPaid': false,
    },
    {
      'id': 'REC_06',
      'customer': 'Hotel Swiss-Belinn Cikande',
      'tier': 'HOREKA',
      'amount': 8600000,
      'limit': 15000000,
      'dueDate': '09 Nov 2026 (4 hari lagi)',
      'category': 'AKAN_DATANG',
      'daysDiff': 4,
      'invoice': 'INV-HP03-261101-0005',
      'itemsSummary': '35.0 KG Ribeye AUS, 25.0 KG Tenderloin',
      'phone': '0821-3344-5566',
      'isPaid': false,
    },
    {
      'id': 'REC_07',
      'customer': 'Rumah Makan Sambal Belut Serang',
      'tier': 'RESTO',
      'amount': 1950000,
      'limit': 3000000,
      'dueDate': '11 Nov 2026 (6 hari lagi)',
      'category': 'AKAN_DATANG',
      'daysDiff': 6,
      'invoice': 'INV-HP03-261103-0019',
      'itemsSummary': '30.0 KG Tetelan Rawon Super',
      'phone': '0878-6655-4433',
      'isPaid': false,
    },
  ];

  final List<Map<String, dynamic>> _topProducts = const [
    {
      'rank': 1,
      'name': 'Ribeye Meltique AUS',
      'weightKg': 160.0,
      'omzetRupiah': 38400000,
      'omzetFormatted': 'Rp 38.400.000',
      'share': '32.2%',
    },
    {
      'rank': 2,
      'name': 'Sirloin Choice USA',
      'weightKg': 150.0,
      'omzetRupiah': 31500000,
      'omzetFormatted': 'Rp 31.500.000',
      'share': '26.4%',
    },
    {
      'rank': 3,
      'name': 'US Beef Shortplate',
      'weightKg': 180.0,
      'omzetRupiah': 22500000,
      'omzetFormatted': 'Rp 22.500.000',
      'share': '18.9%',
    },
    {
      'rank': 4,
      'name': 'Tetelan Rawon Super',
      'weightKg': 180.0,
      'omzetRupiah': 15300000,
      'omzetFormatted': 'Rp 15.300.000',
      'share': '12.8%',
    },
    {
      'rank': 5,
      'name': 'Tenderloin Grassfed',
      'weightKg': 40.0,
      'omzetRupiah': 11600000,
      'omzetFormatted': 'Rp 11.600.000',
      'share': '9.7%',
    },
  ];

  void _showModulLainnya(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        const primaryNavy = Color(0xFF0F172A);
        const cardBorder = Color(0xFFE2E8F0);
        const slateMuted = Color(0xFF64748B);

        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.only(
              topLeft: Radius.circular(24),
              topRight: Radius.circular(24),
            ),
          ),
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Grab Handle
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFFCBD5E1),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      Text(
                        'Modul Lainnya (Enterprise ERP)',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: primaryNavy,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Akuntansi, audit trail, dan kepatuhan perpajakan',
                        style: TextStyle(fontSize: 12, color: slateMuted),
                      ),
                    ],
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(ctx),
                    icon: const Icon(Icons.close_rounded, size: 20, color: slateMuted),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              // Grid 4 Enterprise Modules
              GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisCount: 2,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: 1.45,
                children: [
                  _buildHubCard(
                    ctx,
                    title: 'Laporan & Akuntansi',
                    subtitle: 'Jurnal Umum, P&L, Buku Besar',
                    icon: Icons.menu_book_rounded,
                    iconColor: const Color(0xFF6366F1),
                    bgColor: const Color(0xFFEEF2FF),
                    onTap: () {
                      Navigator.pop(ctx);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Membuka Laporan Keuangan & Jurnal Umum HashMicro...'),
                          backgroundColor: primaryNavy,
                        ),
                      );
                    },
                  ),
                  _buildHubCard(
                    ctx,
                    title: 'Kepatuhan Pajak',
                    subtitle: 'PPh Final 0.5% (PP 55) & PPN',
                    icon: Icons.receipt_long_rounded,
                    iconColor: const Color(0xFF059669),
                    bgColor: const Color(0xFFECFDF5),
                    onTap: () {
                      Navigator.pop(ctx);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Pajak UMKM 0.5% terhitung otomatis dari omzet bruto.'),
                          backgroundColor: Color(0xFF059669),
                        ),
                      );
                    },
                  ),
                  _buildHubCard(
                    ctx,
                    title: 'Immutable Audit Trail',
                    subtitle: 'Inspector Trigger Drift SQLite',
                    icon: Icons.security_rounded,
                    iconColor: const Color(0xFFD97706),
                    bgColor: const Color(0xFFFFFBEB),
                    onTap: () {
                      Navigator.pop(ctx);
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const ConflictResolutionScreen()),
                      );
                    },
                  ),
                  _buildHubCard(
                    ctx,
                    title: 'Pengaturan & Staf',
                    subtitle: 'Hak Akses PIN & Shift Toko',
                    icon: Icons.manage_accounts_rounded,
                    iconColor: const Color(0xFF475569),
                    bgColor: const Color(0xFFF1F5F9),
                    onTap: () {
                      Navigator.pop(ctx);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Pengaturan Perangkat HP03 & Multi-User Toko.'),
                          backgroundColor: primaryNavy,
                        ),
                      );
                    },
                  ),
                  _buildHubCard(
                    ctx,
                    title: 'Konversi Yield (MOD-07)',
                    subtitle: 'Primal ke Steak & Tetelan',
                    icon: Icons.content_cut_rounded,
                    iconColor: const Color(0xFFD97706),
                    bgColor: const Color(0xFFFEF3C7),
                    onTap: () {
                      Navigator.pop(ctx);
                      _showYieldConversionDialog(context);
                    },
                  ),
                  _buildHubCard(
                    ctx,
                    title: 'Voice Note Sales (MOD-21)',
                    subtitle: 'Pesan Suara WhatsApp Gemini AI',
                    icon: Icons.mic_rounded,
                    iconColor: const Color(0xFF059669),
                    bgColor: const Color(0xFFECFDF5),
                    onTap: () {
                      Navigator.pop(ctx);
                      _showVoiceOrderDialog(context);
                    },
                  ),
                  _buildHubCard(
                    ctx,
                    title: 'Retur Komplain (MOD-08)',
                    subtitle: 'Kamera Bukti & Karantina',
                    icon: Icons.replay_rounded,
                    iconColor: const Color(0xFFE11D48),
                    bgColor: const Color(0xFFFFE4E6),
                    onTap: () {
                      Navigator.pop(ctx);
                      _showReturnComplaintDialog(context);
                    },
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildHubCard(
    BuildContext context, {
    required String title,
    required String subtitle,
    required IconData icon,
    required Color iconColor,
    required Color bgColor,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: bgColor,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, color: iconColor, size: 20),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0F172A),
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  subtitle,
                  style: const TextStyle(fontSize: 10, color: Color(0xFF64748B)),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _showYieldConversionDialog(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        int effectiveHpp = 242000;

        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            return Container(
              padding: const EdgeInsets.all(20),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(24),
                  topRight: Radius.circular(24),
                ),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: const [
                          Icon(Icons.content_cut_rounded, color: Color(0xFFD97706), size: 22),
                          SizedBox(width: 8),
                          Text(
                            'Konversi Yield & Susut (MOD-07)',
                            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFF0F172A)),
                          ),
                        ],
                      ),
                      IconButton(
                        onPressed: () => Navigator.pop(ctx),
                        icon: const Icon(Icons.close_rounded, size: 20),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Pemotongan Primal Ribeye -> Steak Porsi (8.2 KG) + Tetelan (1.5 KG) + Susut (0.3 KG).',
                    style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Kalkulasi Retribusi HPP Anti-Deadstock:',
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Modal Bahan Baku: Rp 2.100.000\nNilai Tetelan: -Rp 97.500\nHPP Efektif Steak: Rp $effectiveHpp / KG',
                          style: const TextStyle(fontSize: 12, height: 1.4, color: Color(0xFF334155)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: () {
                        Navigator.pop(ctx);
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Konversi Yield Berhasil! Susut 0.3 KG tercatat ke Ledger.'),
                            backgroundColor: Color(0xFF0F172A),
                          ),
                        );
                      },
                      icon: const Icon(Icons.check_circle_rounded, size: 18),
                      label: const Text('Simpan ke Stock Ledger (MOD-07)'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0F172A),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  void _showVoiceOrderDialog(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          padding: const EdgeInsets.all(20),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.only(
              topLeft: Radius.circular(24),
              topRight: Radius.circular(24),
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: const [
                      Icon(Icons.mic_rounded, color: Color(0xFF059669), size: 22),
                      SizedBox(width: 8),
                      Text(
                        'Voice Note Sales AI (MOD-21)',
                        style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFF0F172A)),
                      ),
                    ],
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(ctx),
                    icon: const Icon(Icons.close_rounded, size: 20),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              const Text(
                'Ekstraksi pesan suara WhatsApp sales lapangan dengan Gemini AI menjadi keranjang belanja kasir.',
                style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
              ),
              const SizedBox(height: 16),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF0F172A),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  children: const [
                    CircleAvatar(
                      radius: 28,
                      backgroundColor: Color(0xFF059669),
                      child: Icon(Icons.mic_rounded, color: Colors.white, size: 28),
                    ),
                    SizedBox(height: 10),
                    Text(
                      '"Hotel Grand Serang minta Australian Ribeye 5 kilo bayar tempo 14 hari"',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 12, fontStyle: FontStyle.italic, color: Colors.white),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () {
                    Navigator.pop(ctx);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Pesanan Suara Sales Berhasil Diterapkan ke Keranjang Kasir!'),
                        backgroundColor: Color(0xFF059669),
                      ),
                    );
                  },
                  icon: const Icon(Icons.shopping_cart_rounded, size: 18),
                  label: const Text('Terapkan ke Keranjang Kasir POS'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF059669),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  void _showReturnComplaintDialog(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          padding: const EdgeInsets.all(20),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.only(
              topLeft: Radius.circular(24),
              topRight: Radius.circular(24),
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: const [
                      Icon(Icons.replay_rounded, color: Color(0xFFE11D48), size: 22),
                      SizedBox(width: 8),
                      Text(
                        'Retur Komplain Daging (MOD-08)',
                        style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFF0F172A)),
                      ),
                    ],
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(ctx),
                    icon: const Icon(Icons.close_rounded, size: 20),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              const Text(
                'Klaim retur komplain mutu pelanggan wajib foto kamera inspeksi & isolasi ke Cold Storage Karantina.',
                style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF1F2),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFFECDD3)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Text(
                      'Hotel Grand Serang • Faktur INV-HP03-261102-0012',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF9F1239)),
                    ),
                    SizedBox(height: 4),
                    Text(
                      '5.0 KG Ribeye AUS (Alasan: Bau Asam / Suhu Reefer Rusak)\nResolusi: Terbitkan Credit Note',
                      style: TextStyle(fontSize: 11, color: Color(0xFF881337)),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () {
                    Navigator.pop(ctx);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Retur Daging Diproses! Diisolasi ke Chiller Karantina & Credit Note Diterbitkan.'),
                        backgroundColor: Color(0xFFE11D48),
                      ),
                    );
                  },
                  icon: const Icon(Icons.shield_rounded, size: 18),
                  label: const Text('Proses Retur & Karantina (MOD-08)'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFE11D48),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    const primaryNavy = Color(0xFF0F172A);
    const accentEmerald = Color(0xFF10B981);
    const slateMuted = Color(0xFF64748B);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        titleSpacing: 16,
        title: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: primaryNavy,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.inventory_2_rounded, size: 18, color: accentEmerald),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                Text(
                  'ERP KARKASIA',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.3,
                    color: primaryNavy,
                  ),
                ),
                Text(
                  'Toko KARKASIA 01 • HP03',
                  style: TextStyle(fontSize: 11, color: slateMuted, fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ],
        ),
        actions: [
          // Online/Offline Status Pill (GoPay Microcopy)
          GestureDetector(
            onTap: () {
              setState(() => _isOnline = !_isOnline);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(
                    _isOnline
                        ? 'Online kembali, Boss! Sinkronisasi otomatis berjalan lancar.'
                        : 'Sedang offline, Boss. Transaksi tetap tersimpan aman di HP dan akan disinkronkan saat online.',
                  ),
                  backgroundColor: _isOnline ? accentEmerald : const Color(0xFFD97706),
                ),
              );
            },
            child: Container(
              margin: const EdgeInsets.symmetric(vertical: 12),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: _isOnline ? const Color(0xFFECFDF5) : const Color(0xFFFFFBEB),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: _isOnline ? const Color(0xFFA7F3D0) : const Color(0xFFFDE68A),
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 7,
                    height: 7,
                    decoration: BoxDecoration(
                      color: _isOnline ? accentEmerald : const Color(0xFFD97706),
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 5),
                  Text(
                    _isOnline ? 'Online' : 'Offline',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: _isOnline ? const Color(0xFF065F46) : const Color(0xFF92400E),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 8),

          // Modul Lainnya Grid Button
          IconButton(
            tooltip: 'Modul Lainnya',
            onPressed: () => _showModulLainnya(context),
            icon: Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.grid_view_rounded, size: 18, color: primaryNavy),
            ),
          ),
          const SizedBox(width: 12),
        ],
      ),
      body: IndexedStack(
        index: _currentIndex,
        children: [
          _buildHomeDashboardTab(context),
          const PosScreen(),
          _buildPurchasingTab(context),
          const FefoWarehouseScreen(),
          _buildAccountsPayableTab(context),
        ],
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: Color(0xFFE2E8F0), width: 1)),
        ),
        child: NavigationBar(
          height: 64,
          elevation: 0,
          backgroundColor: Colors.white,
          indicatorColor: const Color(0xFFF1F5F9),
          selectedIndex: _currentIndex,
          onDestinationSelected: (idx) => setState(() => _currentIndex = idx),
          destinations: const [
            NavigationDestination(
              icon: Icon(Icons.home_outlined),
              selectedIcon: Icon(Icons.home_rounded, color: primaryNavy),
              label: 'Home',
            ),
            NavigationDestination(
              icon: Icon(Icons.point_of_sale_outlined),
              selectedIcon: Icon(Icons.point_of_sale_rounded, color: primaryNavy),
              label: 'Kasir',
            ),
            NavigationDestination(
              icon: Icon(Icons.local_shipping_outlined),
              selectedIcon: Icon(Icons.local_shipping_rounded, color: primaryNavy),
              label: 'Beli',
            ),
            NavigationDestination(
              icon: Icon(Icons.inventory_2_outlined),
              selectedIcon: Icon(Icons.inventory_2_rounded, color: primaryNavy),
              label: 'Stok Barang',
            ),
            NavigationDestination(
              icon: Icon(Icons.account_balance_wallet_outlined),
              selectedIcon: Icon(Icons.account_balance_wallet_rounded, color: primaryNavy),
              label: 'Bayar',
            ),
          ],
        ),
      ),
    );
  }

  // =========================================================================
  // TAB 1: HOME (GOPAY STYLE DASHBOARD: CLEAN, MOTIVATIONAL, INSTANT STATUS)
  // =========================================================================
  Widget _buildHomeDashboardTab(BuildContext context) {
    const primaryNavy = Color(0xFF0F172A);
    const accentEmerald = Color(0xFF10B981);
    const slateMuted = Color(0xFF64748B);
    const cardBorder = Color(0xFFE2E8F0);

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // GoPay Friendly Motivational Greeting Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.06),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Halo, Boss Mercyzone! 👋',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: accentEmerald.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: accentEmerald.withOpacity(0.4)),
                      ),
                      child: const Text(
                        'Target On Track 🎯',
                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF6EE7B7)),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                const Text(
                  'Semangat jualan daging import hari ini. Cold storage stabil di -18°C.',
                  style: TextStyle(fontSize: 12, color: Color(0xFFCBD5E1)),
                ),
                const SizedBox(height: 16),
                // Quick Balance & Omzet Summary
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: const [
                            Text('Omzet Hari Ini', style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
                            SizedBox(height: 2),
                            Text(
                              'Rp 18.500.000',
                              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white),
                            ),
                          ],
                        ),
                      ),
                      Container(width: 1, height: 32, color: Colors.white.withOpacity(0.15)),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: const [
                            Text('Daging Terjual', style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
                            SizedBox(height: 2),
                            Text(
                              '154.5 KG',
                              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF6EE7B7)),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Operational Status Indicators (3-Detik Scan)
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: const [
              Text(
                'Kondisi Operasional Toko',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: primaryNavy),
              ),
              Text(
                'Real-Time Live',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: accentEmerald),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Status Cards Grid
          Row(
            children: [
              Expanded(
                child: _buildStatusCard(
                  title: 'Nilai Stok HPP',
                  value: 'Rp 38.64 Jt',
                  subtitle: '154.5 KG di freezer',
                  icon: Icons.inventory_rounded,
                  iconColor: accentEmerald,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildStatusCard(
                  title: 'Piutang Tempo',
                  value: 'Rp 16.90 Jt',
                  subtitle: '2 Resto Horeka',
                  icon: Icons.pending_actions_rounded,
                  iconColor: const Color(0xFFD97706),
                ),
              ),
            ],
          ),

          const SizedBox(height: 16),

          // Top 5 Produk Terlaris Section (Visualisasi Tren Omzet)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: cardBorder),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: const [
                        Icon(Icons.bar_chart_rounded, size: 20, color: accentEmerald),
                        SizedBox(width: 8),
                        Text(
                          'Top 5 Produk Terlaris',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                            color: primaryNavy,
                          ),
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text(
                        'Total Rp 119.3 Jt',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: primaryNavy,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                const Text(
                  'Peringkat kontributor penjualan daging import periode berjalan',
                  style: TextStyle(fontSize: 11, color: slateMuted),
                ),
                const SizedBox(height: 16),

                // Top 5 Bars List
                ..._topProducts.map((item) {
                  final double progress = (item['omzetRupiah'] as int) / 38400000.0;
                  final int rank = item['rank'] as int;

                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                Container(
                                  width: 20,
                                  height: 20,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    color: rank == 1
                                        ? const Color(0xFFFEF3C7)
                                        : (rank == 2 ? const Color(0xFFE2E8F0) : const Color(0xFFF1F5F9)),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Text(
                                    '$rank',
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w800,
                                      color: rank == 1 ? const Color(0xFF92400E) : primaryNavy,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  item['name'] as String,
                                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: primaryNavy),
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  '(${item['weightKg']} kg)',
                                  style: const TextStyle(fontSize: 10, color: slateMuted),
                                ),
                              ],
                            ),
                            Text(
                              item['omzetFormatted'] as String,
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: primaryNavy),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: TweenAnimationBuilder<double>(
                            duration: const Duration(milliseconds: 700),
                            curve: Curves.easeOutCubic,
                            tween: Tween<double>(begin: 0, end: progress),
                            builder: (ctx, val, _) {
                              return LinearProgressIndicator(
                                value: val,
                                backgroundColor: const Color(0xFFF1F5F9),
                                valueColor: AlwaysStoppedAnimation<Color>(
                                  rank == 1 ? primaryNavy : (rank == 2 ? const Color(0xFF334155) : accentEmerald),
                                ),
                                minHeight: 7,
                              );
                            },
                          ),
                        ),
                      ],
                    ),
                  );
                }),
              ],
            ),
          ),

          const SizedBox(height: 14),

          // Microcopy Feed Banner
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: cardBorder),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.thumb_up_alt_rounded, color: Color(0xFF2563EB), size: 18),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      Text(
                        'Mantap! Semua sinkronisasi beres.',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: primaryNavy),
                      ),
                      SizedBox(height: 1),
                      Text(
                        '0 antrean pending di HP. Data siap audit kapan saja.',
                        style: TextStyle(fontSize: 11, color: slateMuted),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickAction({
    required String label,
    required IconData icon,
    required Color bgColor,
    required Color iconColor,
    required VoidCallback onTap,
  }) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: bgColor,
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: iconColor, size: 20),
              ),
              const SizedBox(height: 6),
              Text(
                label,
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0F172A),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatusCard({
    required String title,
    required String value,
    required String subtitle,
    required IconData icon,
    required Color iconColor,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(title, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
              Icon(icon, size: 16, color: iconColor),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: Color(0xFF0F172A),
            ),
          ),
          const SizedBox(height: 2),
          Text(subtitle, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
        ],
      ),
    );
  }

  // =========================================================================
  // TAB 3: BELI (PURCHASING & INBOUND CONTAINER RECEIVING)
  // =========================================================================
  Widget _buildPurchasingTab(BuildContext context) {
    const primaryNavy = Color(0xFF0F172A);
    const cardBorder = Color(0xFFE2E8F0);
    const slateMuted = Color(0xFF64748B);

    final inboundPOs = [
      {
        'poNumber': 'PO-2611-004',
        'supplier': 'PT Meat Importers Indonesia',
        'container': 'TGHU-992341 (40ft Reefer)',
        'eta': 'Besok Siang (05 Nov)',
        'items': 'Ribeye Meltique AUS (500 KG), Sirloin (300 KG)',
        'status': 'DALAM_PERJALANAN',
      },
      {
        'poNumber': 'PO-2610-098',
        'supplier': 'Australia Beef Direct Ltd',
        'container': 'MSKU-102938 (20ft Reefer)',
        'eta': 'Diterima & Lolos Karantina',
        'items': 'Tenderloin Grassfed AUS (200 KG)',
        'status': 'SELESAI_BONGKAR',
      },
    ];

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  Text(
                    'Penerimaan Kontainer & Pembelian',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: primaryNavy),
                  ),
                  Text('Inbound kontainer reefer & penimbangan timbang tara', style: TextStyle(fontSize: 11, color: slateMuted)),
                ],
              ),
              ElevatedButton.icon(
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Form Buat PO Kontainer Baru')),
                  );
                },
                icon: const Icon(Icons.add, size: 16),
                label: const Text('Buat PO', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: primaryNavy,
                  minimumSize: const Size(90, 36),
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                ),
              ),
            ],
          ),

          const SizedBox(height: 16),

          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: inboundPOs.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, i) {
              final po = inboundPOs[i];
              final isEnRoute = po['status'] == 'DALAM_PERJALANAN';

              return Container(
                padding: const EdgeInsets.all(14),
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
                        Text(
                          po['poNumber']!,
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: primaryNavy),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: isEnRoute ? const Color(0xFFEFF6FF) : const Color(0xFFECFDF5),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            isEnRoute ? '🚛 Dalam Perjalanan' : '✓ Siap di Freezer',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: isEnRoute ? const Color(0xFF1D4ED8) : const Color(0xFF065F46),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      po['supplier']!,
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: primaryNavy),
                    ),
                    const SizedBox(height: 2),
                    Text('Kontainer: ${po['container']}', style: const TextStyle(fontSize: 11, color: slateMuted)),
                    Text('Muatan: ${po['items']}', style: const TextStyle(fontSize: 11, color: slateMuted)),
                    const SizedBox(height: 10),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('ETA: ${po['eta']}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: primaryNavy)),
                        if (isEnRoute)
                          OutlinedButton(
                            onPressed: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Mantap! Pembongkaran kontainer dicatat ke stock_ledger.'),
                                  backgroundColor: Color(0xFF10B981),
                                ),
                              );
                            },
                            style: OutlinedButton.styleFrom(
                              minimumSize: const Size(100, 32),
                              padding: const EdgeInsets.symmetric(horizontal: 10),
                            ),
                            child: const Text('Bongkar Muat', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                          ),
                      ],
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  // =========================================================================
  // TAB 5: BAYAR (HUTANG, PIUTANG TEMPO, BILLS & PENAGIHAN SALES)
  // =========================================================================
  Widget _buildAccountsPayableTab(BuildContext context) {
    const primaryNavy = Color(0xFF0F172A);
    const cardBorder = Color(0xFFE2E8F0);
    const slateMuted = Color(0xFF64748B);
    const accentEmerald = Color(0xFF10B981);
    const amberAlert = Color(0xFFD97706);
    const roseAlert = Color(0xFFDC2626);
    const blueNotice = Color(0xFF2563EB);

    String formatRp(int value) =>
        value.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]}.');

    final unpaid = _receivablesData.where((r) => r['isPaid'] != true).toList();

    // Category metrics
    final terlambatList = unpaid.where((r) => r['category'] == 'TERLAMBAT').toList();
    final totalTerlambat = terlambatList.fold<int>(0, (sum, r) => sum + (r['amount'] as int));

    final hariIniList = unpaid.where((r) => r['category'] == 'HARI_INI').toList();
    final totalHariIni = hariIniList.fold<int>(0, (sum, r) => sum + (r['amount'] as int));

    final akanDatangList = unpaid.where((r) => r['category'] == 'AKAN_DATANG').toList();
    final totalAkanDatang = akanDatangList.fold<int>(0, (sum, r) => sum + (r['amount'] as int));

    final lebih7HariList = unpaid.where((r) => r['category'] == 'LEBIH_7_HARI').toList();
    final totalLebih7Hari = lebih7HariList.fold<int>(0, (sum, r) => sum + (r['amount'] as int));

    final totalAll = unpaid.fold<int>(0, (sum, r) => sum + (r['amount'] as int));

    // Filtered list
    final filtered = _receivablesData.where((r) {
      if (_receivableFilter == 'HARI_INI' && r['category'] != 'HARI_INI') return false;
      if (_receivableFilter == 'TERLAMBAT' && r['category'] != 'TERLAMBAT') return false;
      if (_receivableFilter == 'AKAN_DATANG' && r['category'] != 'AKAN_DATANG') return false;
      if (_receivableFilter == 'LEBIH_7_HARI' && r['category'] != 'LEBIH_7_HARI') return false;

      if (_receivableSearch.trim().isNotEmpty) {
        final query = _receivableSearch.toLowerCase().trim();
        final customer = (r['customer'] as String).toLowerCase();
        final invoice = (r['invoice'] as String).toLowerCase();
        if (!customer.contains(query) && !invoice.contains(query)) return false;
      }
      return true;
    }).toList();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Text(
                      'Buku Piutang & Penagihan Faktur Tempo',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: primaryNavy),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Monitoring jatuh tempo pelanggan Horeka dengan proteksi plafon kredit.',
                      style: TextStyle(fontSize: 11, color: slateMuted),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.file_download_outlined, color: primaryNavy, size: 22),
                tooltip: 'Ekspor Data Piutang',
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Data rekapitulasi piutang tempo berhasil diekspor.'),
                      backgroundColor: primaryNavy,
                    ),
                  );
                },
              ),
            ],
          ),

          const SizedBox(height: 16),

          // -----------------------------------------------------------------
          // 4 SUMMARY KPI CARDS: NILAI PIUTANG PER KATEGORI
          // -----------------------------------------------------------------
          GridView.count(
            crossAxisCount: 2,
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            childAspectRatio: 1.5,
            children: [
              // 1. Jatuh Tempo Hari Ini
              InkWell(
                onTap: () => setState(() {
                  _receivableFilter = _receivableFilter == 'HARI_INI' ? 'ALL' : 'HARI_INI';
                }),
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: _receivableFilter == 'HARI_INI' ? const Color(0xFFFFFBEB) : Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: _receivableFilter == 'HARI_INI' ? amberAlert : cardBorder,
                      width: _receivableFilter == 'HARI_INI' ? 1.5 : 1,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: const [
                          Text('Hari Ini', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: amberAlert)),
                          Icon(Icons.access_time_rounded, size: 16, color: amberAlert),
                        ],
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Rp ${formatRp(totalHariIni)}',
                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: amberAlert),
                          ),
                          Text('${hariIniList.length} Faktur Hari Ini', style: const TextStyle(fontSize: 10, color: slateMuted)),
                        ],
                      ),
                    ],
                  ),
                ),
              ),

              // 2. Terlambat (Overdue)
              InkWell(
                onTap: () => setState(() {
                  _receivableFilter = _receivableFilter == 'TERLAMBAT' ? 'ALL' : 'TERLAMBAT';
                }),
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: _receivableFilter == 'TERLAMBAT' ? const Color(0xFFFEF2F2) : Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: _receivableFilter == 'TERLAMBAT' ? roseAlert : cardBorder,
                      width: _receivableFilter == 'TERLAMBAT' ? 1.5 : 1,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: const [
                          Text('Terlambat', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: roseAlert)),
                          Icon(Icons.warning_amber_rounded, size: 16, color: roseAlert),
                        ],
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Rp ${formatRp(totalTerlambat)}',
                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: roseAlert),
                          ),
                          Text('${terlambatList.length} Faktur Menunggak', style: const TextStyle(fontSize: 10, color: slateMuted)),
                        ],
                      ),
                    ],
                  ),
                ),
              ),

              // 3. Akan Datang (7 Hari)
              InkWell(
                onTap: () => setState(() {
                  _receivableFilter = _receivableFilter == 'AKAN_DATANG' ? 'ALL' : 'AKAN_DATANG';
                }),
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: _receivableFilter == 'AKAN_DATANG' ? const Color(0xFFEFF6FF) : Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: _receivableFilter == 'AKAN_DATANG' ? blueNotice : cardBorder,
                      width: _receivableFilter == 'AKAN_DATANG' ? 1.5 : 1,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: const [
                          Text('Akan Datang (7H)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: blueNotice)),
                          Icon(Icons.calendar_today_rounded, size: 16, color: blueNotice),
                        ],
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Rp ${formatRp(totalAkanDatang)}',
                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: blueNotice),
                          ),
                          Text('${akanDatangList.length} Faktur Minggu Ini', style: const TextStyle(fontSize: 10, color: slateMuted)),
                        ],
                      ),
                    ],
                  ),
                ),
              ),

              // 4. Total Piutang Aktif
              InkWell(
                onTap: () => setState(() => _receivableFilter = 'ALL'),
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: primaryNavy,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: _receivableFilter == 'ALL' ? accentEmerald : primaryNavy,
                      width: _receivableFilter == 'ALL' ? 1.5 : 1,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: const [
                          Text('Total Piutang', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white)),
                          Icon(Icons.account_balance_wallet_rounded, size: 16, color: accentEmerald),
                        ],
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Rp ${formatRp(totalAll)}',
                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Colors.white),
                          ),
                          Text('${unpaid.length} Tagihan Berjalan', style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 16),

          // -----------------------------------------------------------------
          // AGING SCHEDULE BAR VISUALIZER (TERLAMBAT VS JATUH TEMPO)
          // -----------------------------------------------------------------
          Container(
            padding: const EdgeInsets.all(14),
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
                  children: const [
                    Text(
                      'Distribusi Umur Piutang (Aging Schedule)',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: primaryNavy),
                    ),
                    Icon(Icons.bar_chart_rounded, size: 18, color: slateMuted),
                  ],
                ),
                const SizedBox(height: 2),
                const Text(
                  'Bagan visual perbandingan tagihan terlambat vs jatuh tempo untuk prioritas penagihan kas.',
                  style: TextStyle(fontSize: 10, color: slateMuted),
                ),
                const SizedBox(height: 12),

                // 1. Terlambat
                _buildAgingBarRow(
                  label: 'Terlambat (Overdue)',
                  amountRp: totalTerlambat,
                  count: terlambatList.length,
                  totalAll: totalAll,
                  color: roseAlert,
                  riskLabel: 'Risiko Tinggi',
                  actionText: 'Prioritas 1: Kunjungi resto & tagih',
                  onTap: () => setState(() => _receivableFilter = _receivableFilter == 'TERLAMBAT' ? 'ALL' : 'TERLAMBAT'),
                  isSelected: _receivableFilter == 'TERLAMBAT',
                ),
                const SizedBox(height: 8),

                // 2. Jatuh Tempo Hari Ini
                _buildAgingBarRow(
                  label: 'Jatuh Tempo Hari Ini',
                  amountRp: totalHariIni,
                  count: hariIniList.length,
                  totalAll: totalAll,
                  color: amberAlert,
                  riskLabel: 'Segera Tagih',
                  actionText: 'Follow up WA kasir & transfer hari ini',
                  onTap: () => setState(() => _receivableFilter = _receivableFilter == 'HARI_INI' ? 'ALL' : 'HARI_INI'),
                  isSelected: _receivableFilter == 'HARI_INI',
                ),
                const SizedBox(height: 8),

                // 3. Akan Datang (1-7 Hari)
                _buildAgingBarRow(
                  label: 'Akan Datang (1-7 Hari)',
                  amountRp: totalAkanDatang,
                  count: akanDatangList.length,
                  totalAll: totalAll,
                  color: blueNotice,
                  riskLabel: 'Mendatang',
                  actionText: 'Monitoring & rekap tagihan',
                  onTap: () => setState(() => _receivableFilter = _receivableFilter == 'AKAN_DATANG' ? 'ALL' : 'AKAN_DATANG'),
                  isSelected: _receivableFilter == 'AKAN_DATANG',
                ),
                const SizedBox(height: 8),

                // 4. Akan Datang (>7 Hari)
                _buildAgingBarRow(
                  label: 'Akan Datang (>7 Hari)',
                  amountRp: totalLebih7Hari,
                  count: lebih7HariList.length,
                  totalAll: totalAll,
                  color: accentEmerald,
                  riskLabel: 'Aman / Lancar',
                  actionText: 'Kondisi lancar, simpan arsip DO',
                  onTap: () => setState(() => _receivableFilter = _receivableFilter == 'LEBIH_7_HARI' ? 'ALL' : 'LEBIH_7_HARI'),
                  isSelected: _receivableFilter == 'LEBIH_7_HARI',
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // -----------------------------------------------------------------
          // FILTER CHIPS & SEARCH BAR
          // -----------------------------------------------------------------
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildFilterChip(
                  label: 'Semua (${_receivablesData.length})',
                  isActive: _receivableFilter == 'ALL',
                  onTap: () => setState(() => _receivableFilter = 'ALL'),
                ),
                const SizedBox(width: 8),
                _buildFilterChip(
                  label: 'Jatuh Tempo Hari Ini (${hariIniList.length})',
                  isActive: _receivableFilter == 'HARI_INI',
                  activeColor: amberAlert,
                  onTap: () => setState(() => _receivableFilter = 'HARI_INI'),
                ),
                const SizedBox(width: 8),
                _buildFilterChip(
                  label: 'Terlambat (${terlambatList.length})',
                  isActive: _receivableFilter == 'TERLAMBAT',
                  activeColor: roseAlert,
                  onTap: () => setState(() => _receivableFilter = 'TERLAMBAT'),
                ),
                const SizedBox(width: 8),
                _buildFilterChip(
                  label: 'Akan Datang 7H (${akanDatangList.length})',
                  isActive: _receivableFilter == 'AKAN_DATANG',
                  activeColor: blueNotice,
                  onTap: () => setState(() => _receivableFilter = 'AKAN_DATANG'),
                ),
                const SizedBox(width: 8),
                _buildFilterChip(
                  label: '> 7 Hari (${lebih7HariList.length})',
                  isActive: _receivableFilter == 'LEBIH_7_HARI',
                  activeColor: accentEmerald,
                  onTap: () => setState(() => _receivableFilter = 'LEBIH_7_HARI'),
                ),
              ],
            ),
          ),

          const SizedBox(height: 12),

          // Search Field
          TextField(
            onChanged: (val) => setState(() => _receivableSearch = val),
            style: const TextStyle(fontSize: 12),
            decoration: InputDecoration(
              hintText: 'Cari pelanggan atau no. invoice...',
              hintStyle: const TextStyle(fontSize: 12, color: slateMuted),
              prefixIcon: const Icon(Icons.search_rounded, size: 18, color: slateMuted),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              filled: true,
              fillColor: Colors.white,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: const BorderSide(color: cardBorder),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: const BorderSide(color: cardBorder),
              ),
            ),
          ),

          const SizedBox(height: 16),

          // -----------------------------------------------------------------
          // INVOICE CARDS LIST
          // -----------------------------------------------------------------
          if (filtered.isEmpty)
            Container(
              padding: const EdgeInsets.all(24),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: cardBorder),
              ),
              child: Column(
                children: const [
                  Icon(Icons.check_circle_outline_rounded, size: 36, color: accentEmerald),
                  SizedBox(height: 8),
                  Text('Tidak Ada Faktur Ditemukan', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                  SizedBox(height: 4),
                  Text('Semua piutang pada filter ini sudah lunas atau tidak cocok dengan pencarian.',
                      textAlign: TextAlign.center, style: TextStyle(fontSize: 11, color: slateMuted)),
                ],
              ),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: filtered.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, i) {
                final r = filtered[i];
                final isPaid = r['isPaid'] == true;
                final category = r['category'] as String;

                Color badgeColor;
                String badgeText;
                if (isPaid) {
                  badgeColor = accentEmerald;
                  badgeText = 'LUNAS';
                } else if (category == 'TERLAMBAT') {
                  badgeColor = roseAlert;
                  badgeText = 'Terlambat ${(r['daysDiff'] as int).abs()} Hari';
                } else if (category == 'HARI_INI') {
                  badgeColor = amberAlert;
                  badgeText = 'Jatuh Tempo Hari Ini';
                } else if (category == 'AKAN_DATANG') {
                  badgeColor = blueNotice;
                  badgeText = 'Akan Datang (${r['daysDiff']} Hari)';
                } else {
                  badgeColor = slateMuted;
                  badgeText = 'Tempo > 7 Hari';
                }

                final amount = r['amount'] as int;
                final limit = r['limit'] as int;
                final creditUsagePct = ((amount / limit) * 100).clamp(0, 100).toInt();

                return Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: isPaid ? const Color(0xFFF8FAFC) : Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isPaid ? cardBorder : category == 'TERLAMBAT' ? const Color(0xFFFECACA) : cardBorder,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Row(
                              children: [
                                Text(
                                  r['customer'] as String,
                                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: primaryNavy),
                                ),
                                const SizedBox(width: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: badgeColor.withOpacity(0.12),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    badgeText,
                                    style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: badgeColor),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            'Rp ${formatRp(amount)}',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w800,
                              color: isPaid ? slateMuted : category == 'TERLAMBAT' ? roseAlert : primaryNavy,
                              decoration: isPaid ? TextDecoration.lineThrough : null,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text('Faktur: ${r['invoice']} • ${r['itemsSummary']}',
                          style: const TextStyle(fontSize: 10, color: slateMuted)),
                      const SizedBox(height: 2),
                      Text('Jatuh Tempo: ${r['dueDate']}',
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: badgeColor)),
                      const SizedBox(height: 8),

                      // Limit Usage Indicator
                      Row(
                        children: [
                          Expanded(
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(4),
                              child: LinearProgressIndicator(
                                value: creditUsagePct / 100.0,
                                backgroundColor: const Color(0xFFF1F5F9),
                                valueColor: AlwaysStoppedAnimation<Color>(
                                  creditUsagePct > 80 ? roseAlert : creditUsagePct > 50 ? amberAlert : accentEmerald,
                                ),
                                minHeight: 4,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            'Plafon: Rp ${formatRp(limit)} ($creditUsagePct%)',
                            style: const TextStyle(fontSize: 10, color: slateMuted),
                          ),
                        ],
                      ),

                      const SizedBox(height: 10),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          if (!isPaid)
                            OutlinedButton.icon(
                              onPressed: () {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text('Draft WhatsApp untuk ${r['customer']} disalin ke memori HP.'),
                                    backgroundColor: primaryNavy,
                                  ),
                                );
                              },
                              icon: const Icon(Icons.chat_bubble_outline_rounded, size: 14),
                              label: const Text('Follow Up WA', style: TextStyle(fontSize: 11)),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: slateMuted,
                                side: const BorderSide(color: cardBorder),
                                minimumSize: const Size(0, 30),
                                padding: const EdgeInsets.symmetric(horizontal: 10),
                              ),
                            ),
                          const SizedBox(width: 8),
                          ElevatedButton.icon(
                            onPressed: () {
                              setState(() {
                                r['isPaid'] = !isPaid;
                              });
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(
                                    !isPaid
                                        ? 'Pelunasan piutang ${r['customer']} (Rp ${formatRp(amount)}) berhasil dicatat ke kas!'
                                        : 'Status tagihan ${r['customer']} dibatalkan.',
                                  ),
                                  backgroundColor: !isPaid ? accentEmerald : primaryNavy,
                                ),
                              );
                            },
                            icon: Icon(isPaid ? Icons.undo_rounded : Icons.check_circle_outline_rounded, size: 14),
                            label: Text(
                              isPaid ? 'Batal Lunas' : 'Catat Pelunasan',
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: isPaid ? slateMuted : accentEmerald,
                              foregroundColor: Colors.white,
                              minimumSize: const Size(0, 30),
                              padding: const EdgeInsets.symmetric(horizontal: 10),
                              elevation: 0,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                );
              },
            ),
        ],
      ),
    );
  }

  Widget _buildAgingBarRow({
    required String label,
    required int amountRp,
    required int count,
    required int totalAll,
    required Color color,
    required String riskLabel,
    required String actionText,
    required VoidCallback onTap,
    required bool isSelected,
  }) {
    final pct = totalAll > 0 ? (amountRp / totalAll) : 0.0;
    final pctString = (pct * 100).toStringAsFixed(1);
    final jutaFormatted = (amountRp / 1000000).toStringAsFixed(1);

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? color.withOpacity(0.08) : const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isSelected ? color : const Color(0xFFE2E8F0),
            width: isSelected ? 1.5 : 1,
          ),
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
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      label,
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                      decoration: BoxDecoration(
                        color: color.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        riskLabel,
                        style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: color),
                      ),
                    ),
                  ],
                ),
                Text(
                  'Rp $jutaFormatted Jt ($pctString%)',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: color),
                ),
              ],
            ),
            const SizedBox(height: 6),
            ClipRRect(
              borderRadius: BorderRadius.circular(3),
              child: LinearProgressIndicator(
                value: pct.clamp(0.0, 1.0),
                backgroundColor: const Color(0xFFE2E8F0),
                valueColor: AlwaysStoppedAnimation<Color>(color),
                minHeight: 5,
              ),
            ),
            const SizedBox(height: 4),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '💡 $actionText',
                  style: const TextStyle(fontSize: 10, color: Color(0xFF64748B), fontStyle: FontStyle.italic),
                ),
                Text(
                  '$count Faktur',
                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFF475569)),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterChip({
    required String label,
    required bool isActive,
    Color activeColor = const Color(0xFF0F172A),
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isActive ? activeColor : const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: isActive ? Colors.white : const Color(0xFF475569),
          ),
        ),
      ),
    );
  }
}
