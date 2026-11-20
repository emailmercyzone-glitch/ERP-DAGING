import { getChartAccount } from '../chartOfAccounts';
import { resolveInventoryAccountCode } from '../inventoryAccounts';

export type ControlAccountAuditStatus = 'MATCH' | 'MISMATCH' | 'INVALID' | 'UNAVAILABLE';

export interface ControlAccountAuditCheck {
  accountCode: string;
  accountName: string;
  expectedBalanceRupiah: number | null;
  ledgerBalanceRupiah: number | null;
  differenceRupiah: number | null;
  status: ControlAccountAuditStatus;
  note?: string;
}

export interface ControlAccountAuditState {
  journals: Array<{
    uuid?: string;
    lines: Array<{ accountCode: string; debit: number; credit: number }>;
  }>;
  cashInHandRupiah: number;
  bankBalanceRupiah?: number;
  bankBalanceInitialized?: boolean;
  pettyCashBalanceRupiah: number;
  receivables: Array<{ id?: string; amount: number; status: string }>;
  supplierInvoices: Array<{ id?: string; remainingAmountRupiah: number; status: string }>;
  lots: Array<{
    id: string;
    code: string;
    productId?: string;
    isQuarantined: boolean;
    weightGram: number;
    hppKgRupiah: number;
  }>;
}

export interface ControlAccountAuditResult {
  isReconciled: boolean;
  checks: ControlAccountAuditCheck[];
  errors: string[];
  totalDebitRupiah: number;
  totalCreditRupiah: number;
}

/**
 * Read-only reconciliation between journal control accounts and operational
 * cash, AR/AP and lot-value projections. It never repairs or mutates state.
 */
export function auditControlAccountReconciliation(
  state: ControlAccountAuditState
): ControlAccountAuditResult {
  const errors: string[] = [];
  let totalDebitRupiah = 0;
  let totalCreditRupiah = 0;
  const ledgerBalances = new Map<string, number>();

  for (const journal of state.journals) {
    let journalDebit = 0;
    let journalCredit = 0;
    for (const line of journal.lines) {
      if (!Number.isSafeInteger(line.debit) || line.debit < 0 ||
          !Number.isSafeInteger(line.credit) || line.credit < 0) {
        errors.push(`Jurnal ${journal.uuid || '(tanpa ID)'} memiliki nominal debit/kredit tidak valid.`);
        continue;
      }
      if (!getChartAccount(line.accountCode)) errors.push(`Jurnal ${journal.uuid || '(tanpa ID)'} memakai akun ${line.accountCode} yang tidak terdaftar.`);
      journalDebit += line.debit;
      journalCredit += line.credit;
      if (!Number.isSafeInteger(journalDebit) || !Number.isSafeInteger(journalCredit)) {
        errors.push(`Jurnal ${journal.uuid || '(tanpa ID)'} melewati batas integer Rupiah aman.`);
        continue;
      }
      const signed = line.debit - line.credit;
      const current = ledgerBalances.get(line.accountCode) ?? 0;
      const next = current + signed;
      if (!Number.isSafeInteger(next)) {
        errors.push(`Saldo buku besar akun ${line.accountCode} melewati batas integer Rupiah aman.`);
        continue;
      }
      ledgerBalances.set(line.accountCode, next);
    }
    totalDebitRupiah += journalDebit;
    totalCreditRupiah += journalCredit;
    if (!Number.isSafeInteger(totalDebitRupiah) || !Number.isSafeInteger(totalCreditRupiah)) {
      errors.push('Total neraca saldo melewati batas integer Rupiah aman.');
    }
    if (journalDebit !== journalCredit) {
      errors.push(`Jurnal ${journal.uuid || '(tanpa ID)'} tidak balance: debit ${journalDebit}, kredit ${journalCredit}.`);
    }
  }

  const expectedInventory: Record<'1301' | '1302' | '1303' | '1304', number> = {
    '1301': 0, '1302': 0, '1303': 0, '1304': 0,
  };
  for (const lot of state.lots) {
    if (!Number.isSafeInteger(lot.weightGram) || lot.weightGram < 0 ||
        !Number.isSafeInteger(lot.hppKgRupiah) || lot.hppKgRupiah < 0) {
      errors.push(`Lot ${lot.code || lot.id} memiliki berat/HPP yang tidak valid untuk rekonsiliasi.`);
      continue;
    }
    const value = Math.round((lot.weightGram * lot.hppKgRupiah) / 1000);
    if (!Number.isSafeInteger(value) || value < 0) {
      errors.push(`Nilai lot ${lot.code || lot.id} melewati batas integer Rupiah aman.`);
      continue;
    }
    const accountCode = resolveInventoryAccountCode(lot);
    const next = expectedInventory[accountCode] + value;
    if (!Number.isSafeInteger(next)) {
      errors.push(`Nilai persediaan akun ${accountCode} melewati batas integer Rupiah aman.`);
      continue;
    }
    expectedInventory[accountCode] = next;
  }

  const sumSubledger = <T>(
    rows: T[],
    getAmount: (row: T) => number,
    getId: (row: T) => string
  ): number | null => {
    let total = 0;
    for (const row of rows) {
      const amount = getAmount(row);
      if (!Number.isSafeInteger(amount) || amount < 0) {
        errors.push(`Saldo subledger ${getId(row)} harus berupa integer Rupiah aman non-negatif.`);
        return null;
      }
      total += amount;
      if (!Number.isSafeInteger(total)) {
        errors.push(`Total subledger melewati batas integer Rupiah aman (${getId(row)}).`);
        return null;
      }
    }
    return total;
  };

  const expectedAR = sumSubledger(
    state.receivables.filter((item) => item.status !== 'LUNAS'),
    (item) => item.amount,
    (item) => item.id || 'piutang'
  );
  const expectedAP = sumSubledger(
    state.supplierInvoices.filter((item) => item.status !== 'LUNAS'),
    (item) => item.remainingAmountRupiah,
    (item) => item.id || 'utang-supplier'
  );

  const compare = (
    accountCode: string,
    expected: number | null,
    normalBalance: 'DEBIT' | 'CREDIT' = 'DEBIT',
    note?: string
  ): ControlAccountAuditCheck => {
    const account = getChartAccount(accountCode);
    const rawBalance = ledgerBalances.get(accountCode) ?? 0;
    const ledgerBalanceRupiah = normalBalance === 'DEBIT' ? rawBalance : -rawBalance;
    if (expected === null) {
      return {
        accountCode, accountName: account?.name ?? accountCode,
        expectedBalanceRupiah: null, ledgerBalanceRupiah, differenceRupiah: null,
        status: 'INVALID', note: note || 'Subledger tidak valid.',
      };
    }
    if (!Number.isSafeInteger(expected) || expected < 0) {
      return {
        accountCode, accountName: account?.name ?? accountCode,
        expectedBalanceRupiah: expected, ledgerBalanceRupiah, differenceRupiah: null,
        status: 'INVALID', note: note || 'Saldo proyeksi tidak valid.',
      };
    }
    const differenceRupiah = ledgerBalanceRupiah - expected;
    return {
      accountCode, accountName: account?.name ?? accountCode,
      expectedBalanceRupiah: expected, ledgerBalanceRupiah, differenceRupiah,
      status: differenceRupiah === 0 ? 'MATCH' : 'MISMATCH',
      ...(note ? { note } : {}),
    };
  };

  const checks: ControlAccountAuditCheck[] = [
    compare('1101', state.cashInHandRupiah),
    state.bankBalanceInitialized !== true || state.bankBalanceRupiah === undefined
      ? {
          accountCode: '1102', accountName: getChartAccount('1102')?.name ?? 'Bank Usaha',
          expectedBalanceRupiah: null, ledgerBalanceRupiah: ledgerBalances.get('1102') ?? 0,
          differenceRupiah: null, status: 'UNAVAILABLE', note: 'Saldo awal bank belum diverifikasi; rekonsiliasi bank belum dapat dinyatakan selesai.',
        }
      : compare('1102', state.bankBalanceRupiah),
    compare('1103', state.pettyCashBalanceRupiah),
    compare('1201', expectedAR),
    ...(['1301', '1302', '1303', '1304'] as const).map((code) => compare(code, expectedInventory[code])),
    compare('2101', expectedAP, 'CREDIT'),
  ];

  const isReconciled = errors.length === 0 && checks.every((check) => check.status === 'MATCH');
  return { isReconciled, checks, errors, totalDebitRupiah, totalCreditRupiah };
}
