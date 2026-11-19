export type AccountType =
  | 'ASSET'
  | 'LIABILITY'
  | 'EQUITY'
  | 'REVENUE'
  | 'CONTRA_REVENUE'
  | 'OTHER_INCOME'
  | 'COGS'
  | 'EXPENSE';

export interface ChartOfAccountDefinition {
  code: string;
  name: string;
  type: AccountType;
  normalBalance: 'DEBIT' | 'CREDIT';
}

/**
 * Canonical Chart of Accounts. Codes are stable identifiers; labels are never
 * supplied by individual transaction handlers.
 */
export const CHART_OF_ACCOUNTS = {
  '1101': { code: '1101', name: 'Kas Tunai', type: 'ASSET', normalBalance: 'DEBIT' },
  '1102': { code: '1102', name: 'Bank Usaha', type: 'ASSET', normalBalance: 'DEBIT' },
  '1103': { code: '1103', name: 'Kas Kecil Toko', type: 'ASSET', normalBalance: 'DEBIT' },
  '1201': { code: '1201', name: 'Piutang Pelanggan', type: 'ASSET', normalBalance: 'DEBIT' },
  '1301': { code: '1301', name: 'Persediaan Daging', type: 'ASSET', normalBalance: 'DEBIT' },
  '1302': { code: '1302', name: 'Persediaan Daging Steak Siap Jual', type: 'ASSET', normalBalance: 'DEBIT' },
  '1303': { code: '1303', name: 'Persediaan Tetelan Hasil Potong', type: 'ASSET', normalBalance: 'DEBIT' },
  '1304': { code: '1304', name: 'Persediaan Karantina Retur', type: 'ASSET', normalBalance: 'DEBIT' },
  '2101': { code: '2101', name: 'Utang Supplier', type: 'LIABILITY', normalBalance: 'CREDIT' },
  '3101': { code: '3101', name: 'Modal Usaha', type: 'EQUITY', normalBalance: 'CREDIT' },
  '4101': { code: '4101', name: 'Penjualan Daging', type: 'REVENUE', normalBalance: 'CREDIT' },
  '4102': { code: '4102', name: 'Pendapatan Jasa Pengiriman', type: 'REVENUE', normalBalance: 'CREDIT' },
  '4103': { code: '4103', name: 'Potongan & Retur Penjualan', type: 'CONTRA_REVENUE', normalBalance: 'DEBIT' },
  '4201': { code: '4201', name: 'Pendapatan Penyesuaian Stok', type: 'OTHER_INCOME', normalBalance: 'CREDIT' },
  '5101': { code: '5101', name: 'Harga Pokok Penjualan', type: 'COGS', normalBalance: 'DEBIT' },
  '5201': { code: '5201', name: 'Beban Susut & Selisih Stok', type: 'EXPENSE', normalBalance: 'DEBIT' },
  '6101': { code: '6101', name: 'Biaya Operasional', type: 'EXPENSE', normalBalance: 'DEBIT' },
} as const satisfies Record<string, ChartOfAccountDefinition>;

export type AccountCode = keyof typeof CHART_OF_ACCOUNTS;

export function getChartAccount(code: string): ChartOfAccountDefinition | undefined {
  return CHART_OF_ACCOUNTS[code as AccountCode];
}

export function canonicalizeJournalLines<T extends { accountCode: string; accountName: string }>(lines: T[]): T[] {
  return lines.map((line) => {
    const account = getChartAccount(line.accountCode);
    if (!account) throw new Error(`JOURNAL_INVARIANT: kode akun ${line.accountCode} belum terdaftar di Chart of Accounts.`);
    return { ...line, accountName: account.name };
  });
}

/**
 * Canonicalize known historical account labels without changing amounts or dropping
 * unknown legacy codes. Unknown codes are reported by the journal integrity audit.
 */
export function normalizeJournalAccountNames<T extends { accountCode: string; accountName: string }>(lines: T[]): T[] {
  return lines.map((line) => {
    const account = getChartAccount(line.accountCode);
    return account ? { ...line, accountName: account.name } : line;
  });
}
