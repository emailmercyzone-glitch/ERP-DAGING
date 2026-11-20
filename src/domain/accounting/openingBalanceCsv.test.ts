import assert from 'node:assert/strict';
import test from 'node:test';
import { previewOpeningBalanceCsv } from './openingBalanceCsv';

test('opening balance lot CSV previews exact Gram, Pcs, and Rupiah totals', () => {
  const result = previewOpeningBalanceCsv(
    'LOTS',
    'sku,lot_code,expiry_date,total_gram,total_pcs,cost_total_rupiah,supplier_code\nBEEF-01,LOT-A,2027-01-31,12500,0,1875000,SUP-01\nBEEF-02,LOT-B,2027-02-28,7500,4,925000,SUP-02',
    { skuCodes: ['BEEF-01', 'BEEF-02'], supplierCodes: ['SUP-01', 'SUP-02'] }
  );

  assert.equal(result.ok, true);
  assert.equal(result.rowCount, 2);
  assert.deepEqual(result.totals, {
    stockGram: 20000,
    stockPcs: 4,
    inventoryCostRupiah: 2800000,
    receivablesRupiah: 0,
    payablesRupiah: 0,
  });
  assert.deepEqual(result.rows[0], { sku: 'BEEF-01', lotCode: 'LOT-A', expiryDate: '2027-01-31', totalGram: 12500, totalPcs: 0, costTotalRupiah: 1875000, supplierCode: 'SUP-01' });
});

test('opening receivable CSV validates customer references and aggregates balances', () => {
  const result = previewOpeningBalanceCsv(
    'RECEIVABLES',
    'customer_code,invoice_no,amount_due_rupiah,due_date\nC-01,INV-001,1250000,2026-11-30\nC-02,INV-002,750000,2026-12-15',
    { customerCodes: ['C-01', 'C-02'] }
  );

  assert.equal(result.ok, true);
  assert.equal(result.totals.receivablesRupiah, 2000000);
});

test('opening payable CSV validates supplier references and aggregates balances', () => {
  const result = previewOpeningBalanceCsv(
    'PAYABLES',
    'supplier_code,reference_no,amount_due_rupiah,due_date\nSUP-01,BILL-001,500000,2026-11-25',
    { supplierCodes: ['SUP-01'] }
  );

  assert.equal(result.ok, true);
  assert.equal(result.totals.payablesRupiah, 500000);
});

test('opening balance CSV rejects decimal and formatted money instead of rounding', () => {
  const result = previewOpeningBalanceCsv(
    'RECEIVABLES',
    'customer_code,invoice_no,amount_due_rupiah,due_date\nC-01,INV-001,1.250.000,2026-11-30',
    { customerCodes: ['C-01'] }
  );

  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === 'INVALID_INTEGER'));
});

test('opening balance CSV rejects duplicate headers and malformed quoting', () => {
  const duplicateHeader = previewOpeningBalanceCsv(
    'PAYABLES',
    'supplier_code,reference_no,reference_no,amount_due_rupiah,due_date\nSUP-01,B-1,B-2,100,2026-11-30'
  );
  assert.equal(duplicateHeader.ok, false);
  assert.ok(duplicateHeader.issues.some((issue) => issue.code === 'HEADER'));

  const malformed = previewOpeningBalanceCsv(
    'PAYABLES',
    'supplier_code,reference_no,amount_due_rupiah,due_date\nSUP-01,"BILL-1,100,2026-11-30'
  );
  assert.equal(malformed.ok, false);
  assert.ok(malformed.issues.some((issue) => issue.code === 'CSV_SYNTAX'));
});

test('opening balance CSV rejects invalid dates, unknown references, and duplicate business keys', () => {
  const result = previewOpeningBalanceCsv(
    'LOTS',
    'sku,lot_code,expiry_date,total_gram,total_pcs,cost_total_rupiah,supplier_code\nUNKNOWN,LOT-A,2026-02-30,1000,0,100000,SUP-01\nUNKNOWN,LOT-A,2027-01-01,1000,0,100000,SUP-01',
    { skuCodes: ['BEEF-01'], supplierCodes: ['SUP-01'] }
  );

  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === 'INVALID_DATE'));
  assert.ok(result.issues.some((issue) => issue.code === 'UNKNOWN_REFERENCE'));
  assert.ok(result.issues.some((issue) => issue.code === 'DUPLICATE'));
});

test('opening balance CSV ignores blank trailing lines but rejects empty imports', () => {
  const valid = previewOpeningBalanceCsv(
    'RECEIVABLES',
    '\uFEFFcustomer_code,invoice_no,amount_due_rupiah,due_date\r\nC-01,"INV,001",1000,2026-11-30\r\n\r\n',
    { customerCodes: ['C-01'] }
  );
  assert.equal(valid.ok, true);
  assert.equal(valid.rowCount, 1);

  const empty = previewOpeningBalanceCsv('PAYABLES', 'supplier_code,reference_no,amount_due_rupiah,due_date\n');
  assert.equal(empty.ok, false);
  assert.ok(empty.issues.some((issue) => issue.code === 'EMPTY'));
});
