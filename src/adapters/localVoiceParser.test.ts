import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIndonesianVoiceOrderLocally } from './localVoiceParser.ts';

test('local voice parser uses only supplied ERP product/customer master data', () => {
  const result = parseIndonesianVoiceOrderLocally(
    'Hotel Grand Serang minta ribeye 2 kg transfer',
    {
      products: [{ sku: 'RIB-AUS-01', name: 'Australian Ribeye Chilled', unitPriceRupiah: 210000 }],
      customers: [{ id: 'C-001', name: 'Hotel Grand Serang' }],
    }
  );
  assert.equal(result.customerName, 'Hotel Grand Serang');
  assert.equal(result.paymentMethod, 'TRANSFER');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].productSku, 'RIB-AUS-01');
  assert.equal(result.items[0].productName, 'Australian Ribeye Chilled');
  assert.equal(result.items[0].weightGram, 2000);
  assert.equal(result.items[0].unitPriceRupiah, 210000);
});

test('local voice parser does not fabricate products when catalog is missing or no product matches', () => {
  const noCatalog = parseIndonesianVoiceOrderLocally('ribeye 2 kg');
  assert.equal(noCatalog.items.length, 0);
  assert.match(noCatalog.notes, /katalog ERP/);
  const unknown = parseIndonesianVoiceOrderLocally('kirim wagyu 3 kg', {
    products: [{ sku: 'RIB-AUS-01', name: 'Australian Ribeye Chilled', unitPriceRupiah: 210000 }],
  });
  assert.equal(unknown.items.length, 0);
});

test('local voice parser returns an unresolved draft when multiple products match ambiguously', () => {
  const result = parseIndonesianVoiceOrderLocally('ribeye 2 kg', {
    products: [
      { sku: 'RIB-AUS-01', name: 'Australian Ribeye Chilled', unitPriceRupiah: 210000 },
      { sku: 'RIB-US-01', name: 'US Ribeye Chilled', unitPriceRupiah: 220000 },
    ],
  });
  assert.equal(result.items.length, 0);
});

test('local voice parser resolves multiple products by distinct catalog terms', () => {
  const result = parseIndonesianVoiceOrderLocally('ribeye 2 kg dan shortplate 500 gram', {
    products: [
      { sku: 'RIB-AUS-01', name: 'Australian Ribeye Chilled', unitPriceRupiah: 210000 },
      { sku: 'SPL-US-01', name: 'US Beef Shortplate Sliced', unitPriceRupiah: 125000 },
    ],
  });
  assert.deepEqual(result.items.map((item) => [item.productSku, item.weightGram]), [
    ['RIB-AUS-01', 2000],
    ['SPL-US-01', 500],
  ]);
});
