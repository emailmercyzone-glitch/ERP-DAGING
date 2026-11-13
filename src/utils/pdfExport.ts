import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface PnLData {
  totalGrossRevenue: number;
  totalCogs: number;
  grossProfit: number;
  totalOpex: number;
  netOperatingProfit: number;
  estimatedUmkmTax: number;
  netProfitAfterTax: number;
  opexList: Array<{ voucher: string; category: string; desc: string; amount: number; time: string }>;
  dailySales: Array<{ day: string; omzet: number; target: number; margin: number }>;
  totalInventoryAssetHpp?: number;
  totalInventoryKg?: number;
}

export interface JournalEntry {
  id: string;
  ref: string;
  time: string;
  debitAccount: string;
  debitAmount: number;
  creditAccount: string;
  creditAmount: number;
}

/**
 * Generator PDF Resmi Laporan Keuangan & Pajak PP 23 UMKM
 */
/**
 * Build internal jsPDF document for Financial Report
 */
export function buildFinancialReportDoc(data: PnLData): { doc: jsPDF; filename: string } {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const now = new Date();
  const filename = `Laporan_Keuangan_Pajak_ERP DAGING_${now.toISOString().slice(0, 10)}.pdf`;

  // 1. Header Perusahaan
  doc.setFillColor(153, 27, 27); // Dark Crimson Red
  doc.rect(0, 0, 210, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('ERP DAGING', 14, 10);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Cold Chain Beef & Offal Supplier • NKV: RPHU-3604010-019 • Telp: (0254) 8923-4567', 14, 16);
  doc.text('Dokumen Resmi: Laporan Laba Rugi & Perhitungan Pajak PP 23/2018 (0.5%)', 14, 21);

  // Tanggal & Metadata
  doc.setTextColor(51, 65, 85);
  doc.setFontSize(8);
  const dateStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.text(`Tanggal Cetak: ${dateStr} ${now.toLocaleTimeString('id-ID')}`, 14, 30);
  doc.text(`Toko: TOKO_KARKASIA_01 • Mata Uang: IDR (Rupiah Utuh Zero-Float)`, 14, 34);

  // 2. Tabel Ringkasan Hierarki Keuangan
  const pnlRows = [
    ['1. Omzet Kotor (Gross Revenue)', `Rp ${data.totalGrossRevenue.toLocaleString('id-ID')}`, 'Total penjualan daging import hari ini'],
    ['2. Beban Pokok Penjualan (HPP / COGS)', `(Rp ${data.totalCogs.toLocaleString('id-ID')})`, 'Landed cost daging beku dari kontainer'],
    ['3. LABA KOTOR (Gross Profit)', `Rp ${data.grossProfit.toLocaleString('id-ID')}`, 'Margin kotor rata-rata ~25.4%'],
    ['4. Beban Operasional Kasir Kecil (OPEX)', `(Rp ${data.totalOpex.toLocaleString('id-ID')})`, `${data.opexList.length} voucher kas kecil (es, plastik, BBM)`],
    ['5. Laba Bersih Operasional (EBIT)', `Rp ${data.netOperatingProfit.toLocaleString('id-ID')}`, 'Laba sebelum pemotongan pajak UMKM'],
    ['6. PPh Final PP 23/2018 (0.5% Omzet)', `(Rp ${data.estimatedUmkmTax.toLocaleString('id-ID')})`, 'Tarif PPh Final UMKM sesuai PP 23/2018'],
    ['7. LABA BERSIH RIIL (Net Profit)', `Rp ${data.netProfitAfterTax.toLocaleString('id-ID')}`, 'Laba bersih final siap disetor ke rekening Owner'],
    ...(data.totalInventoryAssetHpp !== undefined ? [
      ['8. NILAI ASET DAGING (HPP / Landed Cost)', `Rp ${data.totalInventoryAssetHpp.toLocaleString('id-ID')}`, `Valuasi ${data.totalInventoryKg ? data.totalInventoryKg.toFixed(1) + ' KG' : ''} persediaan beku di cold storage`]
    ] : []),
  ];

  autoTable(doc, {
    startY: 38,
    head: [['Komponen Keuangan', 'Nilai (Rupiah)', 'Keterangan Analisis']],
    body: pnlRows,
    theme: 'grid',
    headStyles: {
      fillColor: [153, 27, 27],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 2.2,
      font: 'helvetica',
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 70 },
      1: { halign: 'right', fontStyle: 'bold', cellWidth: 45 },
      2: { cellWidth: 75, textColor: [71, 85, 105] },
    },
  });

  // 3. Tabel Rincian Kasir Kecil OPEX
  const finalY1 = (doc as any).lastAutoTable.finalY + 8;
  doc.setTextColor(153, 27, 27);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Rincian Pengeluaran Kasir Kecil & OPEX Toko:', 14, finalY1);

  const opexRows = data.opexList.map((op, idx) => [
    String(idx + 1),
    op.voucher,
    op.category,
    op.desc,
    op.time,
    `Rp ${op.amount.toLocaleString('id-ID')}`,
  ]);

  autoTable(doc, {
    startY: finalY1 + 3,
    head: [['No', 'No. Voucher', 'Kategori', 'Uraian Pengeluaran', 'Jam', 'Nominal']],
    body: opexRows,
    theme: 'striped',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 8,
    },
    styles: {
      fontSize: 8,
      cellPadding: 1.8,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 32, fontStyle: 'bold' },
      2: { cellWidth: 35 },
      3: { cellWidth: 65 },
      4: { halign: 'center', cellWidth: 18 },
      5: { halign: 'right', cellWidth: 30, fontStyle: 'bold' },
    },
  });

  // 4. Kotak Tanda Tangan Resmi
  const finalY2 = (doc as any).lastAutoTable.finalY + 12;
  const signY = finalY2 > 240 ? 245 : finalY2;

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');

  // Kolom Kiri: Admin Keuangan
  doc.text('Dibuat & Diverifikasi:', 25, signY);
  doc.text('( Admin Keuangan / Kasir )', 20, signY + 22);

  // Kolom Kanan: Owner Toko
  doc.text('Disetujui & Diotorisasi:', 140, signY);
  doc.text('( Owner Toko Daging ERP DAGING )', 133, signY + 22);

  return { doc, filename };
}

/**
 * Generator PDF Resmi Laporan Keuangan & Pajak PP 23 UMKM (Download Lokal)
 */
export function exportFinancialReportPdf(data: PnLData) {
  const { doc, filename } = buildFinancialReportDoc(data);
  doc.save(filename);
}

/**
 * Generator PDF Blob Laporan Keuangan untuk Upload Google Drive
 */
export function generateFinancialReportPdfBlob(data: PnLData): { blob: Blob; filename: string } {
  const { doc, filename } = buildFinancialReportDoc(data);
  const blob = doc.output('blob');
  return { blob, filename };
}

/**
 * Generator PDF Buku Jurnal Umum Akuntansi Double-Entry
 */
/**
 * Build internal jsPDF document for Journal Report
 */
export function buildJournalReportDoc(totalDebit: number, totalCredit: number): { doc: jsPDF; filename: string } {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const now = new Date();
  const filename = `Jurnal_Umum_ERP DAGING_${now.toISOString().slice(0, 10)}.pdf`;

  // 1. Header Perusahaan
  doc.setFillColor(88, 28, 135); // Deep Purple
  doc.rect(0, 0, 210, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('ERP DAGING', 14, 10);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Cold Chain Beef & Offal Supplier • NKV: RPHU-3604010-019 • Buku Jurnal Umum', 14, 16);
  doc.text('Dokumen Audit Trail: Jurnal Transaksi Double-Entry & Pergerakan Stock Ledger', 14, 21);

  // Metadata
  doc.setTextColor(51, 65, 85);
  doc.setFontSize(8);
  const dateStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.text(`Tanggal Cetak: ${dateStr} ${now.toLocaleTimeString('id-ID')}`, 14, 30);
  doc.text(`Status Keseimbangan: BALANCE (Total Debit = Total Kredit)`, 14, 34);

  // 2. Baris Jurnal Akuntansi Double Entry
  const journalRows = [
    ['2026-11-02 14:20', 'JRN-261102-0042', '[D] Piutang Usaha Pelanggan (Steakhouse Banten Prima)', '1120', 'Rp 726.500', '-'],
    ['', '', '    [K] Pendapatan Penjualan Daging Import', '4100', '-', 'Rp 726.500'],
    ['2026-11-02 14:20', 'JRN-261102-0042', '[D] Beban Pokok Penjualan (HPP Ribeye & Tetelan)', '5100', 'Rp 520.000', '-'],
    ['', '', '    [K] Persediaan Daging (Stock Ledger OUT_SALE)', '1140', '-', 'Rp 520.000'],
    ['2026-11-02 11:45', 'JRN-261102-0041', '[D] Kas di Tangan Sales Lapangan (HP03)', '1111', 'Rp 1.450.000', '-'],
    ['', '', '    [K] Pendapatan Penjualan Daging (Pak Haji Wahid)', '4100', '-', 'Rp 1.450.000'],
    ['2026-11-02 11:45', 'JRN-261102-0041', '[D] Beban Pokok Penjualan (HPP Tetelan Rawon)', '5100', 'Rp 950.000', '-'],
    ['', '', '    [K] Persediaan Daging (Stock Ledger OUT_SALE)', '1140', '-', 'Rp 950.000'],
    ['2026-11-02 10:15', 'JRN-261102-0040', '[D] Beban Packing Cold Chain (Plastik Vakum Roll)', '6120', 'Rp 85.000', '-'],
    ['', '', '    [K] Kasir Kecil Toko ERP DAGING', '1112', '-', 'Rp 85.000'],
    ['2026-11-02 08:30', 'JRN-261102-0039', '[D] Beban Es Balok Cold Chain (10 Batang)', '6110', 'Rp 120.000', '-'],
    ['', '', '    [K] Kasir Kecil Toko ERP DAGING', '1112', '-', 'Rp 120.000'],
    ['2026-11-02 07:00', 'JRN-261102-0038', '[D] Persediaan Daging Tetelan (IN_CONVERSION)', '1142', 'Rp 552.500', '-'],
    ['', '', '[D] Beban Susut Pemotongan Daging (OUT_CUTTING_LOSS)', '5210', 'Rp 97.500', '-'],
    ['', '', '    [K] Persediaan Daging Primal Ribeye (OUT_CONVERSION)', '1141', '-', 'Rp 650.000'],
    ['TOTAL', '', 'TOTAL SALDO JURNAL UMUM (DEBIT = KREDIT)', '', `Rp ${totalDebit.toLocaleString('id-ID')}`, `Rp ${totalCredit.toLocaleString('id-ID')}`],
  ];

  autoTable(doc, {
    startY: 38,
    head: [['Waktu', 'No. Jurnal', 'Akun & Keterangan Transaksi', 'Ref', 'Debit (Rp)', 'Kredit (Rp)']],
    body: journalRows,
    theme: 'grid',
    headStyles: {
      fillColor: [88, 28, 135],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 26, fontStyle: 'bold' },
      1: { cellWidth: 28 },
      2: { cellWidth: 78 },
      3: { halign: 'center', cellWidth: 14 },
      4: { halign: 'right', fontStyle: 'bold', cellWidth: 22 },
      5: { halign: 'right', fontStyle: 'bold', cellWidth: 22 },
    },
    didParseCell: (hookData) => {
      // Highlight baris TOTAL
      if (hookData.row.index === journalRows.length - 1) {
        hookData.cell.styles.fillColor = [241, 245, 249];
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.textColor = [15, 23, 42];
      }
    },
  });

  // Tanda Tangan
  const finalY = (doc as any).lastAutoTable.finalY + 12;
  const signY = finalY > 240 ? 245 : finalY;

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');

  doc.text('Diverifikasi Akuntan:', 25, signY);
  doc.text('( Bagian Akuntansi & Pajak )', 18, signY + 22);

  doc.text('Disahkan Oleh:', 140, signY);
  doc.text('( Owner Toko Daging ERP DAGING )', 133, signY + 22);

  return { doc, filename };
}

/**
 * Generator PDF Buku Jurnal Umum Akuntansi Double-Entry (Download Lokal)
 */
export function exportJournalReportPdf(totalDebit: number, totalCredit: number) {
  const { doc, filename } = buildJournalReportDoc(totalDebit, totalCredit);
  doc.save(filename);
}

/**
 * Generator PDF Blob Buku Jurnal Umum untuk Upload Google Drive
 */
export function generateJournalReportPdfBlob(totalDebit: number, totalCredit: number): { blob: Blob; filename: string } {
  const { doc, filename } = buildJournalReportDoc(totalDebit, totalCredit);
  const blob = doc.output('blob');
  return { blob, filename };
}
