import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { JournalEntry as EngineJournalEntry } from '../engine/types';

export interface PnLData {
  totalGrossRevenue: number;
  totalCogs: number;
  grossProfit: number;
  totalOpex: number;
  netOperatingProfit: number;
  estimatedUmkmTax: number;
  netProfitAfterTax: number;
  opexList: Array<{ voucher: string; category: string; desc: string; amount: number; time: string }>;
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
  const filename = `Laporan_Keuangan_ERP_DAGING_${now.toISOString().slice(0, 10)}.pdf`;

  // 1. Header Perusahaan
  doc.setFillColor(153, 27, 27); // Dark Crimson Red
  doc.rect(0, 0, 210, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('ERP DAGING — LAPORAN KEUANGAN OPERASIONAL', 14, 10);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Ringkasan operasional berdasarkan transaksi dan jurnal yang tersimpan', 14, 16);
  doc.text('Laporan internal • Estimasi PPh Final 0,5% sesuai konfigurasi usaha', 14, 21);

  // Tanggal & Metadata
  doc.setTextColor(51, 65, 85);
  doc.setFontSize(8);
  const dateStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.text(`Tanggal Cetak: ${dateStr} ${now.toLocaleTimeString('id-ID')}`, 14, 30);
  doc.text('Periode: Minggu berjalan • Mata uang: IDR', 14, 34);

  // 2. Tabel Ringkasan Hierarki Keuangan
  const pnlRows = [
    ['1. Omzet Kotor (Gross Revenue)', `Rp ${data.totalGrossRevenue.toLocaleString('id-ID')}`, 'Total transaksi penjualan selesai pada minggu berjalan'],
    ['2. Beban Pokok Penjualan (HPP / COGS)', `(Rp ${data.totalCogs.toLocaleString('id-ID')})`, 'HPP aktual yang tercatat pada transaksi penjualan'],
    ['3. LABA KOTOR (Gross Profit)', `Rp ${data.grossProfit.toLocaleString('id-ID')}`, 'Omzet dikurangi HPP pada periode laporan'],
    ['4. Beban Operasional Kasir Kecil (OPEX)', `(Rp ${data.totalOpex.toLocaleString('id-ID')})`, `${data.opexList.length} voucher kas kecil aktual pada periode laporan`],
    ['5. Laba Bersih Operasional (EBIT)', `Rp ${data.netOperatingProfit.toLocaleString('id-ID')}`, 'Laba kotor dikurangi biaya operasional pada periode laporan'],
    ['6. Estimasi PPh Final (0,5% omzet)', `(Rp ${data.estimatedUmkmTax.toLocaleString('id-ID')})`, 'Estimasi internal sesuai konfigurasi; bukan pengganti perhitungan/pelaporan pajak resmi'],
    ['7. Laba setelah estimasi pajak', `Rp ${data.netProfitAfterTax.toLocaleString('id-ID')}`, 'Hasil perhitungan internal; bukan saldo kas yang otomatis tersedia untuk ditarik'],
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
  doc.text('Rincian Voucher Kas Kecil Periode Berjalan:', 14, finalY1);

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
  doc.text('Disiapkan oleh ERP DAGING:', 25, signY);
  doc.text('( Pemeriksaan internal )', 20, signY + 22);

  // Kolom Kanan: Owner Toko
  doc.text('Diperiksa oleh:', 140, signY);
  doc.text('( Owner )', 133, signY + 22);

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
export function buildJournalReportDoc(journals: EngineJournalEntry[]): { doc: jsPDF; filename: string } {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const now = new Date();
  const filename = `Jurnal_Umum_ERP_DAGING_${now.toISOString().slice(0, 10)}.pdf`;
  const totalDebit = journals.reduce((sum, journal) => sum + journal.totalDebit, 0);
  const totalCredit = journals.reduce((sum, journal) => sum + journal.totalCredit, 0);
  const allBalanced = journals.every((journal) => journal.isBalanced && journal.totalDebit === journal.totalCredit);

  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, 297, 24, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('ERP DAGING — BUKU JURNAL', 14, 10);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Rincian jurnal berdasarkan data lokal yang tercatat di Business Engine', 14, 17);
  doc.setTextColor(51, 65, 85);
  doc.setFontSize(8);
  doc.text(`Dicetak: ${now.toLocaleString('id-ID')}`, 14, 31);
  doc.text(`Status keseimbangan: ${allBalanced ? 'BALANCE' : 'PERLU PEMERIKSAAN'}`, 14, 36);

  const journalRows = journals.flatMap((journal) => journal.lines.map((line, index) => [
    index === 0 ? new Date(journal.timestamp).toLocaleString('id-ID') : '',
    index === 0 ? journal.referenceNo : '',
    `${line.accountName} — ${journal.description}`,
    line.accountCode,
    line.debit > 0 ? `Rp ${line.debit.toLocaleString('id-ID')}` : '-',
    line.credit > 0 ? `Rp ${line.credit.toLocaleString('id-ID')}` : '-',
  ]));
  journalRows.push(['TOTAL', '', 'TOTAL SALDO JURNAL', '', `Rp ${totalDebit.toLocaleString('id-ID')}`, `Rp ${totalCredit.toLocaleString('id-ID')}`]);

  autoTable(doc, {
    startY: 42,
    head: [['Waktu', 'Referensi', 'Akun & Keterangan Transaksi', 'Kode', 'Debit (Rp)', 'Kredit (Rp)']],
    body: journalRows,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 7.5, cellPadding: 1.8 },
    columnStyles: {
      0: { cellWidth: 34 }, 1: { cellWidth: 34 }, 2: { cellWidth: 120 },
      3: { halign: 'center', cellWidth: 18 }, 4: { halign: 'right', fontStyle: 'bold', cellWidth: 34 },
      5: { halign: 'right', fontStyle: 'bold', cellWidth: 34 },
    },
    didParseCell: (hookData) => {
      if (hookData.row.index === journalRows.length - 1) {
        hookData.cell.styles.fillColor = [241, 245, 249];
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.textColor = [15, 23, 42];
      }
    },
  });
  return { doc, filename };
}

/**
 * Generator PDF Buku Jurnal Umum Akuntansi Double-Entry (Download Lokal)
 */
export function exportJournalReportPdf(journals: EngineJournalEntry[]) {
  const { doc, filename } = buildJournalReportDoc(journals);
  doc.save(filename);
}

/**
 * Generator PDF Blob Buku Jurnal Umum untuk Upload Google Drive
 */
export function generateJournalReportPdfBlob(journals: EngineJournalEntry[]): { blob: Blob; filename: string } {
  const { doc, filename } = buildJournalReportDoc(journals);
  const blob = doc.output('blob');
  return { blob, filename };
}
