export type OpeningBalanceCsvKind = 'LOTS' | 'RECEIVABLES' | 'PAYABLES';

export interface OpeningBalanceCatalog {
  skuCodes?: readonly string[];
  customerCodes?: readonly string[];
  supplierCodes?: readonly string[];
}

export interface OpeningBalanceCsvIssue {
  row: number;
  field?: string;
  code: 'CSV_SYNTAX' | 'HEADER' | 'REQUIRED' | 'INVALID_INTEGER' | 'INVALID_DATE' | 'DUPLICATE' | 'UNKNOWN_REFERENCE' | 'EMPTY';
  message: string;
}

export interface OpeningLotBalanceRow {
  sku: string;
  lotCode: string;
  expiryDate: string;
  totalGram: number;
  totalPcs: number;
  costTotalRupiah: number;
  supplierCode: string;
}

export interface OpeningReceivableBalanceRow {
  customerCode: string;
  invoiceNo: string;
  amountDueRupiah: number;
  dueDate: string;
}

export interface OpeningPayableBalanceRow {
  supplierCode: string;
  referenceNo: string;
  amountDueRupiah: number;
  dueDate: string;
}

export type OpeningBalanceCsvRow =
  | OpeningLotBalanceRow
  | OpeningReceivableBalanceRow
  | OpeningPayableBalanceRow;

export interface OpeningBalanceCsvPreview {
  kind: OpeningBalanceCsvKind;
  ok: boolean;
  rows: OpeningBalanceCsvRow[];
  issues: OpeningBalanceCsvIssue[];
  rowCount: number;
  totals: {
    stockGram: number;
    stockPcs: number;
    inventoryCostRupiah: number;
    receivablesRupiah: number;
    payablesRupiah: number;
  };
}

interface ParsedCsv {
  headers: string[];
  rows: string[][];
  issues: OpeningBalanceCsvIssue[];
}

const SCHEMAS: Record<OpeningBalanceCsvKind, readonly string[]> = {
  LOTS: ['sku', 'lot_code', 'expiry_date', 'total_gram', 'total_pcs', 'cost_total_rupiah', 'supplier_code'],
  RECEIVABLES: ['customer_code', 'invoice_no', 'amount_due_rupiah', 'due_date'],
  PAYABLES: ['supplier_code', 'reference_no', 'amount_due_rupiah', 'due_date'],
};

function parseCsvText(input: string): ParsedCsv {
  const source = input.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  const issues: OpeningBalanceCsvIssue[] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let closedQuote = false;
  let rowNumber = 1;

  const pushCell = () => {
    row.push(cell);
    cell = '';
    closedQuote = false;
  };
  const pushRow = () => {
    pushCell();
    if (row.some((value) => value.trim() !== '')) rows.push(row);
    row = [];
    rowNumber += 1;
  };

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (closedQuote && char !== ',' && char !== '\n' && char !== '\r' && char.trim() !== '') {
      issues.push({
        row: rowNumber,
        code: 'CSV_SYNTAX',
        message: 'Ada karakter setelah tanda kutip penutup tanpa pemisah kolom.',
      });
      return { headers: [], rows: [], issues };
    }

    if (char === '"' && cell.length === 0 && !closedQuote) {
      quoted = true;
    } else if (char === ',') {
      pushCell();
    } else if (char === '\n') {
      pushRow();
    } else if (char === '\r') {
      if (source[index + 1] === '\n') index += 1;
      pushRow();
    } else if (!closedQuote) {
      cell += char;
    }
  }

  if (quoted) {
    issues.push({
      row: rowNumber,
      code: 'CSV_SYNTAX',
      message: 'Tanda kutip CSV tidak ditutup.',
    });
    return { headers: [], rows: [], issues };
  }
  if (cell.length > 0 || row.length > 0) pushRow();

  if (rows.length === 0) {
    issues.push({ row: 1, code: 'EMPTY', message: 'File CSV kosong atau tidak memiliki baris data.' });
    return { headers: [], rows: [], issues };
  }

  const headers = rows[0].map((value) => value.trim().toLowerCase());
  const duplicateHeaders = headers.filter((header, index) => headers.indexOf(header) !== index);
  if (duplicateHeaders.length > 0) {
    issues.push({
      row: 1,
      code: 'HEADER',
      message: `Nama kolom duplikat: ${[...new Set(duplicateHeaders)].join(', ')}.`,
    });
  }
  return { headers, rows: rows.slice(1), issues };
}

function parseSafeInteger(
  value: string,
  row: number,
  field: string,
  issues: OpeningBalanceCsvIssue[],
  allowZero: boolean
): number | null {
  const normalized = value.trim();
  if (!/^(0|[1-9]\d*)$/.test(normalized)) {
    issues.push({
      row, field, code: 'INVALID_INTEGER',
      message: `${field} harus berupa angka bulat tanpa desimal atau pemisah ribuan.`,
    });
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || (!allowZero && parsed === 0)) {
    issues.push({
      row, field, code: 'INVALID_INTEGER',
      message: `${field} harus berupa integer aman ${allowZero ? 'non-negatif' : 'positif'}.`,
    });
    return null;
  }
  return parsed;
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function addSafeTotal(current: number, value: number, field: string, row: number, issues: OpeningBalanceCsvIssue[]): number {
  const next = current + value;
  if (!Number.isSafeInteger(next)) {
    issues.push({ row, field, code: 'INVALID_INTEGER', message: `Total ${field} melewati batas integer Rupiah/Gram aman.` });
    return current;
  }
  return next;
}

/**
 * Parse and validate an Opening Balance CSV without mutating application state.
 * This is the deterministic preview/validation layer; committing the preview is
 * a separate atomic engine operation.
 */
export function previewOpeningBalanceCsv(
  kind: OpeningBalanceCsvKind,
  input: string,
  catalog: OpeningBalanceCatalog = {}
): OpeningBalanceCsvPreview {
  const parsed = parseCsvText(input);
  const issues = [...parsed.issues];
  const expected = SCHEMAS[kind];

  if (parsed.headers.length > 0) {
    const missing = expected.filter((header) => !parsed.headers.includes(header));
    const unexpected = parsed.headers.filter((header) => !expected.includes(header));
    if (missing.length || unexpected.length) {
      issues.push({
        row: 1,
        code: 'HEADER',
        message: [
          missing.length ? `Kolom wajib belum ada: ${missing.join(', ')}.` : '',
          unexpected.length ? `Kolom tidak dikenal: ${unexpected.join(', ')}.` : '',
        ].filter(Boolean).join(' '),
      });
    }
  }

  const rows: OpeningBalanceCsvRow[] = [];
  if (parsed.headers.length > 0 && parsed.rows.length === 0 && !issues.some((issue) => issue.code === 'EMPTY')) {
    issues.push({ row: 2, code: 'EMPTY', message: 'CSV hanya berisi header; minimal satu baris saldo awal wajib diisi.' });
  }
  const seenKeys = new Set<string>();
  const totals = {
    stockGram: 0,
    stockPcs: 0,
    inventoryCostRupiah: 0,
    receivablesRupiah: 0,
    payablesRupiah: 0,
  };
  const index = new Map(parsed.headers.map((header, column) => [header, column]));
  const get = (cells: string[], field: string) => cells[index.get(field) ?? -1]?.trim() ?? '';

  if (parsed.headers.length === 0 || issues.some((issue) => issue.code === 'CSV_SYNTAX' || issue.code === 'EMPTY')) {
    return { kind, ok: false, rows, issues, rowCount: 0, totals };
  }

  parsed.rows.forEach((cells, dataIndex) => {
    const rowNumber = dataIndex + 2;
    if (cells.length !== parsed.headers.length) {
      issues.push({
        row: rowNumber, code: 'CSV_SYNTAX',
        message: `Jumlah kolom tidak sesuai header: ditemukan ${cells.length}, seharusnya ${parsed.headers.length}.`,
      });
      return;
    }

    if (kind === 'LOTS') {
      const sku = get(cells, 'sku');
      const lotCode = get(cells, 'lot_code');
      const expiryDate = get(cells, 'expiry_date');
      const supplierCode = get(cells, 'supplier_code');
      const totalGram = parseSafeInteger(get(cells, 'total_gram'), rowNumber, 'total_gram', issues, false);
      const totalPcs = parseSafeInteger(get(cells, 'total_pcs'), rowNumber, 'total_pcs', issues, true);
      const costTotalRupiah = parseSafeInteger(get(cells, 'cost_total_rupiah'), rowNumber, 'cost_total_rupiah', issues, true);
      if (!sku || !lotCode || !supplierCode) {
        issues.push({ row: rowNumber, code: 'REQUIRED', message: 'sku, lot_code, dan supplier_code wajib diisi.' });
      }
      if (!isValidIsoDate(expiryDate)) {
        issues.push({ row: rowNumber, field: 'expiry_date', code: 'INVALID_DATE', message: 'expiry_date harus berupa tanggal valid YYYY-MM-DD.' });
      }
      if (catalog.skuCodes && !catalog.skuCodes.includes(sku)) {
        issues.push({ row: rowNumber, field: 'sku', code: 'UNKNOWN_REFERENCE', message: `SKU ${sku || '(kosong)'} tidak ditemukan pada master produk.` });
      }
      if (catalog.supplierCodes && !catalog.supplierCodes.includes(supplierCode)) {
        issues.push({ row: rowNumber, field: 'supplier_code', code: 'UNKNOWN_REFERENCE', message: `Supplier ${supplierCode || '(kosong)'} tidak ditemukan pada master supplier.` });
      }
      const key = lotCode.toLowerCase();
      if (key && seenKeys.has(key)) issues.push({ row: rowNumber, field: 'lot_code', code: 'DUPLICATE', message: `Kode lot ${lotCode} muncul lebih dari sekali.` });
      if (key) seenKeys.add(key);
      if (totalGram !== null && totalPcs !== null && costTotalRupiah !== null && sku && lotCode && supplierCode && isValidIsoDate(expiryDate)) {
        rows.push({ sku, lotCode, expiryDate, totalGram, totalPcs, costTotalRupiah, supplierCode });
        totals.stockGram = addSafeTotal(totals.stockGram, totalGram, 'stok Gram', rowNumber, issues);
        totals.stockPcs = addSafeTotal(totals.stockPcs, totalPcs, 'stok Pcs', rowNumber, issues);
        totals.inventoryCostRupiah = addSafeTotal(totals.inventoryCostRupiah, costTotalRupiah, 'nilai persediaan', rowNumber, issues);
      }
      return;
    }

    const amountDueRupiah = parseSafeInteger(get(cells, 'amount_due_rupiah'), rowNumber, 'amount_due_rupiah', issues, false);
    const dueDate = get(cells, 'due_date');
    if (!isValidIsoDate(dueDate)) {
      issues.push({ row: rowNumber, field: 'due_date', code: 'INVALID_DATE', message: 'due_date harus berupa tanggal valid YYYY-MM-DD.' });
    }

    if (kind === 'RECEIVABLES') {
      const customerCode = get(cells, 'customer_code');
      const invoiceNo = get(cells, 'invoice_no');
      if (!customerCode || !invoiceNo) {
        issues.push({ row: rowNumber, code: 'REQUIRED', message: 'customer_code dan invoice_no wajib diisi.' });
      }
      if (catalog.customerCodes && !catalog.customerCodes.includes(customerCode)) {
        issues.push({ row: rowNumber, field: 'customer_code', code: 'UNKNOWN_REFERENCE', message: `Pelanggan ${customerCode || '(kosong)'} tidak ditemukan pada master pelanggan.` });
      }
      const key = `${customerCode.toLowerCase()}::${invoiceNo.toLowerCase()}`;
      if (customerCode && invoiceNo && seenKeys.has(key)) {
        issues.push({ row: rowNumber, field: 'invoice_no', code: 'DUPLICATE', message: `Faktur ${invoiceNo} untuk pelanggan ${customerCode} muncul lebih dari sekali.` });
      }
      if (key) seenKeys.add(key);
      if (amountDueRupiah !== null && isValidIsoDate(dueDate) && customerCode && invoiceNo) {
        rows.push({ customerCode, invoiceNo, amountDueRupiah, dueDate });
        totals.receivablesRupiah = addSafeTotal(totals.receivablesRupiah, amountDueRupiah, 'total piutang', rowNumber, issues);
      }
      return;
    }

    const supplierCode = get(cells, 'supplier_code');
    const referenceNo = get(cells, 'reference_no');
    if (!supplierCode || !referenceNo) {
      issues.push({ row: rowNumber, code: 'REQUIRED', message: 'supplier_code dan reference_no wajib diisi.' });
    }
    if (catalog.supplierCodes && !catalog.supplierCodes.includes(supplierCode)) {
      issues.push({ row: rowNumber, field: 'supplier_code', code: 'UNKNOWN_REFERENCE', message: `Supplier ${supplierCode || '(kosong)'} tidak ditemukan pada master supplier.` });
    }
    const key = `${supplierCode.toLowerCase()}::${referenceNo.toLowerCase()}`;
    if (supplierCode && referenceNo && seenKeys.has(key)) {
      issues.push({ row: rowNumber, field: 'reference_no', code: 'DUPLICATE', message: `Referensi utang ${referenceNo} untuk supplier ${supplierCode} muncul lebih dari sekali.` });
    }
    if (key) seenKeys.add(key);
    if (amountDueRupiah !== null && isValidIsoDate(dueDate) && supplierCode && referenceNo) {
      rows.push({ supplierCode, referenceNo, amountDueRupiah, dueDate });
      totals.payablesRupiah = addSafeTotal(totals.payablesRupiah, amountDueRupiah, 'total utang', rowNumber, issues);
    }
  });

  return {
    kind,
    ok: issues.length === 0 && rows.length > 0,
    rows,
    issues,
    rowCount: rows.length,
    totals,
  };
}
