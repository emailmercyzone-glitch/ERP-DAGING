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
                  'SAMPORA BANTEN',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.3,
                    color: primaryNavy,
                  ),
                ),
                Text(
                  'Toko Sampora 01 • HP03',
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

          // GoPay Quick Action Shortcuts
          Row(
            children: [
              _buildQuickAction(
                label: 'Buka Kasir',
                icon: Icons.qr_code_scanner_rounded,
                bgColor: const Color(0xFFEFF6FF),
                iconColor: const Color(0xFF2563EB),
                onTap: () => setState(() => _currentIndex = 1),
              ),
              const SizedBox(width: 10),
              _buildQuickAction(
                label: 'Cek Coldroom',
                icon: Icons.ac_unit_rounded,
                bgColor: const Color(0xFFECFDF5),
                iconColor: accentEmerald,
                onTap: () => setState(() => _currentIndex = 3),
              ),
              const SizedBox(width: 10),
              _buildQuickAction(
                label: 'Penerimaan',
                icon: Icons.input_rounded,
                bgColor: const Color(0xFFFFF7ED),
                iconColor: const Color(0xFFEA580C),
                onTap: () => setState(() => _currentIndex = 2),
              ),
              const SizedBox(width: 10),
              _buildQuickAction(
                label: 'Modul Lain',
                icon: Icons.grid_view_rounded,
                bgColor: const Color(0xFFF1F5F9),
                iconColor: primaryNavy,
                onTap: () => _showModulLainnya(context),
              ),
            ],
          ),

          const SizedBox(height: 20),

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

          const SizedBox(height: 10),

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

    final receivables = [
      {
        'customer': 'Hotel Grand Serang',
        'tier': 'HOREKA',
        'amount': 12500000,
        'limit': 25000000,
        'dueDate': '16 Nov 2026 (12 hari lagi)',
        'invoice': 'INV-HP03-261102-0012',
      },
      {
        'customer': 'Steakhouse Banten Prima',
        'tier': 'HOREKA',
        'amount': 4400000,
        'limit': 5000000,
        'dueDate': '08 Nov 2026 (4 hari lagi)',
        'invoice': 'INV-HP03-261028-0089',
      },
    ];

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: const [
              Text(
                'Tagihan & Penagihan Piutang Tempo',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: primaryNavy),
              ),
              Text(
                'Total: Rp 16.9 Jt',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: primaryNavy),
              ),
            ],
          ),
          const SizedBox(height: 4),
          const Text(
            'Pantau batas tempo pelanggan Horeka agar arus kas toko tetap lancar jaya.',
            style: TextStyle(fontSize: 11, color: slateMuted),
          ),

          const SizedBox(height: 16),

          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: receivables.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, i) {
              final r = receivables[i];
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
                          r['customer'] as String,
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: primaryNavy),
                        ),
                        Text(
                          'Rp ${(r['amount'] as int).toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]}.')}',
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFFDC2626)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text('Faktur: ${r['invoice']}', style: const TextStyle(fontSize: 11, color: slateMuted)),
                    Text('Jatuh Tempo: ${r['dueDate']}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: primaryNavy)),
                    const SizedBox(height: 10),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Plafon: Rp ${(r['limit'] as int).toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]}.')}',
                          style: const TextStyle(fontSize: 11, color: slateMuted),
                        ),
                        ElevatedButton(
                          onPressed: () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text('Pelunasan piutang ${r['customer']} berhasil! Saldo kas toko bertambah.'),
                                backgroundColor: accentEmerald,
                              ),
                            );
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: accentEmerald,
                            minimumSize: const Size(110, 32),
                            padding: const EdgeInsets.symmetric(horizontal: 10),
                          ),
                          child: const Text('Catat Pelunasan', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
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
}
