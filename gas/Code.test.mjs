import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function createGasHarness() {
  const rows = [];
  const sheet = {
    getLastRow() { return rows.length; },
    setFrozenRows() {},
    getRange(row, col, numRows, numCols) {
      return {
        getValues() {
          return Array.from({ length: numRows }, (_, r) =>
            Array.from({ length: numCols }, (_, c) => rows[row - 1 + r]?.[col - 1 + c] ?? '')
          );
        },
        setValues(values) {
          values.forEach((line, r) => {
            const target = row - 1 + r;
            if (!rows[target]) rows[target] = [];
            line.forEach((value, c) => { rows[target][col - 1 + c] = value; });
          });
        },
      };
    },
  };
  const spreadsheet = {
    getSheetByName(name) { return name === 'ERP_SYNC_EVENTS' && rows.length ? sheet : null; },
    insertSheet() {
      rows.push(['serverSeq','storeId','deviceId','uuid','idempotencyKey','entityType','createdAt','summary','payloadJson','serverReceivedAt']);
      return sheet;
    },
  };
  const properties = { SPREADSHEET_ID: 'test-sheet', SYNC_SHARED_SECRET: 'test-secret' };
  const sandbox = {
    console,
    JSON,
    Math,
    Number,
    String,
    Object,
    Array,
    Map,
    Date,
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key) => properties[key] || '' }) },
    SpreadsheetApp: { openById: () => spreadsheet },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput(content) {
        return { content, setMimeType() { return this; }, getContent() { return this.content; } };
      },
    },
  };
  const code = fs.readFileSync(new URL('./Code.gs', import.meta.url), 'utf8');
  vm.runInNewContext(code, sandbox, { filename: 'Code.gs' });
  const post = (body) => JSON.parse(sandbox.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
  return { post, rows };
}

const baseSalePayload = {"transactionUuid":"TX-TEST","invoiceNumber":"INV-TEST","customerId":"CUST-TEST","customerName":"Test customer","paymentMethod":"CASH","totalWeightGram":1000,"subtotalRupiah":100000,"discountRupiah":0,"shippingFee":0,"isFreeShipping":false,"grandTotalRupiah":100000,"paidAmountRupiah":100000,"balanceDueRupiah":0,"tempoDays":0,"totalCogsRupiah":70000,"items":[{"productId":"P-1","productName":"Test product","weightGram":1000,"effectivePricePerKg":100000,"lineTotalRupiah":100000,"movingAvgHppPerKg":70000}],"lotAllocations":[{"lotId":"LOT-1","lotCode":"LOT-1","weightGram":1000,"hppPerKg":70000,"cogsRupiah":70000}]};
const event = (uuid, key, payload = {}) => ({
  uuid, idempotencyKey: key, entityType: 'SALE',
  createdAt: '2026-11-16T10:00:00.000Z', summary: 'Test sale', payload: { ...baseSalePayload, ...payload },
});
const push = (post, storeId, deviceId, events) => post({
  action: 'sync_push', sharedSecret: 'test-secret', storeId, deviceId, events,
});

test('GAS sync push is idempotent for the same event and payload', () => {
  const { post, rows } = createGasHarness();
  const ev = event('SALE-1', 'IDEM-1', { b: 2, a: 1 });
  const first = push(post, 'STORE-A', 'DEVICE-A', [ev]);
  const retry = push(post, 'STORE-A', 'DEVICE-A', [event('SALE-1', 'IDEM-1', { a: 1, b: 2 })]);
  assert.equal(first.ok, true, first.message);
  assert.equal(retry.ok, true, retry.message);
  assert.equal(JSON.stringify(first.serverSeqs), JSON.stringify({ 'SALE-1': 1 }));
  assert.equal(JSON.stringify(retry.serverSeqs), JSON.stringify({ 'SALE-1': 1 }));
  assert.equal(rows.length, 2, 'retry must not append another row');
});

test('GAS rejects idempotency-key reuse with changed event payload', () => {
  const { post, rows } = createGasHarness();
  const initial = push(post, 'STORE-A', 'DEVICE-A', [event('SALE-1', 'IDEM-1')]);
  assert.equal(initial.ok, true, initial.message);
  const collision = push(post, 'STORE-A', 'DEVICE-A', [event('SALE-2', 'IDEM-1', { amount: 999 })]);
  assert.equal(collision.ok, false);
  assert.match(collision.message, /Konflik idempotencyKey/);
  assert.equal(rows.length, 2, 'conflicting batch must not append rows');
});

test('GAS rejects UUID reuse with a different idempotency key', () => {
  const { post, rows } = createGasHarness();
  assert.equal(push(post, 'STORE-A', 'DEVICE-A', [event('SALE-1', 'IDEM-1')]).ok, true);
  const collision = push(post, 'STORE-A', 'DEVICE-A', [event('SALE-1', 'IDEM-2')]);
  assert.equal(collision.ok, false);
  assert.match(collision.message, /Konflik UUID/);
  assert.equal(rows.length, 2);
});

test('GAS scopes idempotency by store and allocates sequence from max stored sequence', () => {
  const { post, rows } = createGasHarness();
  const first = push(post, 'STORE-A', 'DEVICE-A', [event('SALE-A', 'SAME-KEY')]);
  const otherStore = push(post, 'STORE-B', 'DEVICE-B', [event('SALE-B', 'SAME-KEY')]);
  assert.equal(first.ok, true, first.message);
  assert.equal(first.serverSeqs['SALE-A'], 1);
  assert.equal(otherStore.ok, true, otherStore.message);
  assert.equal(otherStore.serverSeqs['SALE-B'], 2);
  rows.splice(1, 1);
  const afterGap = push(post, 'STORE-C', 'DEVICE-C', [event('SALE-C', 'KEY-C')]);
  assert.equal(afterGap.serverSeqs['SALE-C'], 3, 'sequence must not be derived from row count');
});

test('GAS pull isolates store and device, and pages without skipping cursor ranges', () => {
  const { post } = createGasHarness();
  for (let batch = 0; batch < 3; batch++) {
    const events = Array.from({ length: 200 }, (_, i) => {
      const n = batch * 200 + i;
      return event('SALE-' + n, 'IDEM-' + n, { amount: n });
    });
    const result = push(post, 'STORE-A', 'DEVICE-A', events);
    assert.equal(result.ok, true, result.message);
  }
  const otherStorePush = push(post, 'STORE-B', 'DEVICE-X', [event('OTHER-STORE', 'OTHER-KEY')]);
  assert.equal(otherStorePush.ok, true, otherStorePush.message);
  const firstPage = post({ action: 'sync_pull', sharedSecret: 'test-secret', storeId: 'STORE-A', deviceId: 'DEVICE-B', sinceSeq: 0 });
  assert.equal(firstPage.ok, true);
  assert.equal(firstPage.records.length, 500);
  assert.equal(firstPage.lastServerSeq, 500);
  assert.equal(firstPage.records[0].serverSeq, 1);
  assert.equal(firstPage.records.at(-1).serverSeq, 500);
  const secondPage = post({ action: 'sync_pull', sharedSecret: 'test-secret', storeId: 'STORE-A', deviceId: 'DEVICE-B', sinceSeq: firstPage.lastServerSeq });
  assert.equal(secondPage.records.length, 100);
  assert.equal(secondPage.records[0].serverSeq, 501);
  assert.equal(secondPage.lastServerSeq, 601);
  const ownDevice = post({ action: 'sync_pull', sharedSecret: 'test-secret', storeId: 'STORE-A', deviceId: 'DEVICE-A', sinceSeq: 0 });
  assert.equal(ownDevice.records.length, 0);
  assert.equal(ownDevice.lastServerSeq, 601);
  const otherStore = post({ action: 'sync_pull', sharedSecret: 'test-secret', storeId: 'STORE-B', deviceId: 'DEVICE-Y', sinceSeq: 0 });
  assert.equal(otherStore.records.length, 1);
  assert.equal(otherStore.records[0].uuid, 'OTHER-STORE');
});

test('GAS rejects requests without the server-side secret', () => {
  const { post } = createGasHarness();
  const result = post({ action: 'sync_pull', storeId: 'STORE-A', deviceId: 'DEVICE-A', sinceSeq: 0 });
  assert.equal(result.ok, false);
  assert.match(result.message, /shared secret/i);
});


test('GAS rejects unknown entity types and empty payloads without appending', () => {
  const { post, rows } = createGasHarness();
  const unknown = push(post, 'STORE-A', 'DEVICE-A', [{ ...event('EV-UNKNOWN', 'KEY-UNKNOWN'), entityType: 'NOT_A_REAL_EVENT' }]);
  assert.equal(unknown.ok, false);
  assert.match(unknown.message, /entityType tidak dikenal/);
  const empty = push(post, 'STORE-A', 'DEVICE-A', [{ ...event('EV-EMPTY', 'KEY-EMPTY'), payload: {} }]);
  assert.equal(empty.ok, false);
  assert.match(empty.message, /Payload event wajib/);
  assert.equal(rows.length, 1, 'invalid events must not be appended');
});

test('GAS validates required fields and rejects fractional Rupiah/Gram values', () => {
  const { post, rows } = createGasHarness();
  const missing = push(post, 'STORE-A', 'DEVICE-A', [event('EV-MISSING', 'KEY-MISSING', { invoiceNumber: undefined })]);
  assert.equal(missing.ok, false);
  assert.match(missing.message, /invoiceNumber/);
  const fractional = push(post, 'STORE-A', 'DEVICE-A', [event('EV-FRACTION', 'KEY-FRACTION', { totalWeightGram: 1000.5 })]);
  assert.equal(fractional.ok, false);
  assert.match(fractional.message, /wajib integer aman/);
  assert.equal(rows.length, 1, 'invalid events must not be appended');
});

test('GAS validates each supported event family and rejects unknown payment variants', () => {
  const { post, rows } = createGasHarness();
  const payment = {
    uuid: 'PAY-1', idempotencyKey: 'PAY-KEY-1', entityType: 'PAYMENT',
    createdAt: '2026-11-16T10:00:00.000Z', summary: 'Payment',
    payload: { kind: 'RECEIVABLE_PAYMENT', recId: 'REC-1', invoice: 'INV-1', customer: 'Customer', amountRupiah: 50000, paymentMethod: 'CASH' },
  };
  const valid = push(post, 'STORE-A', 'DEVICE-A', [payment]);
  assert.equal(valid.ok, true, valid.message);
  const invalid = push(post, 'STORE-A', 'DEVICE-A', [{
    ...payment, uuid: 'PAY-2', idempotencyKey: 'PAY-KEY-2',
    payload: { kind: 'UNSUPPORTED_PAYMENT', amountRupiah: 50000 },
  }]);
  assert.equal(invalid.ok, false);
  assert.match(invalid.message, /PAYMENT kind tidak dikenal/);
  assert.equal(rows.length, 2, 'only the valid event is stored');
});


test('GAS records a server receipt timestamp separately from the device event timestamp', () => {
  const { post, rows } = createGasHarness();
  const result = push(post, 'STORE-A', 'DEVICE-A', [event('SALE-RECEIPT', 'IDEM-RECEIPT')]);
  assert.equal(result.ok, true, result.message);
  const headers = rows[0];
  const receiptIndex = headers.indexOf('serverReceivedAt');
  assert.ok(receiptIndex >= 0);
  const receivedAt = rows[1][receiptIndex];
  assert.ok(receivedAt);
  assert.notEqual(receivedAt, '2026-11-16T10:00:00.000Z');
  assert.equal(Number.isNaN(Date.parse(receivedAt)), false);
  const pulled = post({ action: 'sync_pull', sharedSecret: 'test-secret', storeId: 'STORE-A', deviceId: 'DEVICE-B', sinceSeq: 0 });
  assert.equal(pulled.records[0].serverReceivedAt, receivedAt);
});


test('GAS rejects malformed nested sale rows before ACK', () => {
  const { post, rows } = createGasHarness();
  const result = push(post, 'STORE-A', 'DEVICE-A', [event('SALE-NESTED-BAD', 'SALE-NESTED-BAD', {
    items: [{ productId: 'P-1', weightGram: 1000.5 }],
  })]);
  assert.equal(result.ok, false);
  assert.match(result.message, /items\[0\]\.productName wajib diisi/);
  assert.equal(rows.length, 1);
});


test('GAS rejects master-data patches with unknown fields and malformed product rows', () => {
  const { post, rows } = createGasHarness();
  const base = {
    uuid: 'MASTER-1', idempotencyKey: 'MASTER-KEY-1', entityType: 'MASTER_DATA',
    createdAt: '2026-11-16T10:00:00.000Z', summary: 'Master patch',
  };
  const unknown = push(post, 'STORE-A', 'DEVICE-A', [{
    ...base, payload: { kind: 'MASTER_DATA_PATCH', changes: { transactions: [] } },
  }]);
  assert.equal(unknown.ok, false);
  assert.match(unknown.message, /field yang tidak diizinkan/);
  const malformed = push(post, 'STORE-A', 'DEVICE-A', [{
    ...base, uuid: 'MASTER-2', idempotencyKey: 'MASTER-KEY-2',
    payload: { kind: 'MASTER_DATA_PATCH', changes: { products: [{ id: 'P-1', sku: 'P-1', name: 'Produk' }] } },
  }]);
  assert.equal(malformed.ok, false);
  assert.match(malformed.message, /basePricePerKg wajib diisi/);
  assert.equal(rows.length, 1);
});
