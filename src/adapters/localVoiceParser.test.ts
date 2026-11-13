import assert from 'node:assert/strict';
import test from 'node:test';
import { parseIndonesianVoiceOrderLocally } from './localVoiceParser';

test('voice parser extracts only explicitly stated product and weight', () => {
  const result = parseIndonesianVoiceOrderLocally('Tolong siapkan 2 kg ribeye, pembayaran transfer');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].productName, 'ribeye');
  assert.equal(result.items[0].weightGram, 2000);
  assert.equal(result.items[0].productSku, '');
  assert.equal(result.items[0].unitPriceRupiah, undefined);
  assert.equal(result.paymentMethod, 'TRANSFER');
});

test('voice parser does not invent a default product or weight', () => {
  const result = parseIndonesianVoiceOrderLocally('Tolong siapkan daging untuk besok');
  assert.equal(result.items.length, 0);
  assert.equal(result.confidenceScore, 0.2);
  assert.match(result.notes, /Tidak ada item yang dibuat otomatis/);
});

test('voice parser extracts multiple explicitly weighted products and explicit tempo days', () => {
  const result = parseIndonesianVoiceOrderLocally('1 kg ribeye dan 500 gram sirloin, tempo 14 hari');
  assert.equal(result.items.length, 2);
  assert.deepEqual(result.items.map((item) => item.weightGram), [1000, 500]);
  assert.equal(result.paymentMethod, 'TEMPO');
  assert.equal(result.tempoDays, 14);
});

test('voice parser does not invent a customer from generic business words', () => {
  const result = parseIndonesianVoiceOrderLocally('Warung minta daging 2 kg');
  assert.equal(result.customerName, 'Pelanggan Umum');
  assert.equal(result.items.length, 0);
});
