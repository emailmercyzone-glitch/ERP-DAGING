/// <reference types="node" />
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addProductCategory,
  applyPulledSyncRecords,
  addProductWithOpeningLot,
  addSupplierRecord,
  allocateLotsFEFO,
  calculateProductTierPrice,
  checkPinAttemptGuard,
  commitSaleTransaction,
  computeDaysLeftFromExpiry,
  createBazarPromo,
  createSeededEngineState,
  deleteProductCategory,
  ENGINE_STORAGE_KEY,
  executeCustomerReturn,
  executeStockOpname,
  executeTrimmingConversion,
  exportEngineBackupJson,
  getProductAvailableStockGram,
  hydrateEngineStateFromIdb,
  isBazarPromoEligible,
  isLotExpired,
  loadEngineState,
  normalizePersistedState,
  parseAndValidateBackupJson,
  persistEngineState,
  receiveInboundPurchase,
  recordCustomerReceivablePayment,
  recordPinAttemptOutcome,
  recordSupplierPayablePayment,
  resetPinAttemptGuard,
  resolveApprovalRequest,
  revertCustomerReceivablePayment,
  selectOperationalSummary,
  subscribePersistenceErrors,
  toggleBazarPromo,
  updateOwnerPin,
  updateMasterData,
  updateSupplierPhoneRecord,
  verifyOwnerPin,
  voidSaleTransaction,
} from './businessEngine.ts';
import type {
  BatchLotEntity,
  BazarPromoEntity,
  BusinessEngineState,
  CustomerEntity,
  ProductCategoryEntity,
  ProductEntity,
} from './types.ts';

function makeProduct(overrides: Partial<ProductEntity> = {}): ProductEntity {
  return {
    id: 'PROD_A',
    sku: 'SKU-A',
    name: 'Ribeye Meltique Australia',
    basePricePerKg: 240000,
    movingAvgHppPerKg: 180000,
    tierPrices: {
      RETAIL: 240000,
      HOREKA: 215000,
      VIP: 195000,
    },
    category: 'PRIMAL',
    stockGram: 10000,
    safetyStockGram: 5000,
    ...overrides,
  };
}

function attachCompletedInvoice(
  state: BusinessEngineState,
  invoiceNumber: string,
  customerId: string,
  product: ProductEntity,
  weightGram: number,
  pricePerKg: number
): BusinessEngineState {
  const lineTotalRupiah = Math.round((weightGram * pricePerKg) / 1000);
  state.transactions = [{
    uuid: `TX-${invoiceNumber}`,
    idempotencyKey: `KEY-${invoiceNumber}`,
    invoiceNumber,
    timestamp: new Date().toISOString(),
    customerId,
    customerName: state.customers.find((c) => c.id === customerId)?.name ?? 'Hotel Grand Serang',
    customerTier: 'HOREKA',
    paymentMethod: 'CASH',
    tempoDays: 0,
    totalWeightGram: weightGram,
    subtotalRupiah: lineTotalRupiah,
    shippingFee: 0,
    isFreeShipping: true,
    grandTotalRupiah: lineTotalRupiah,
    paidAmountRupiah: lineTotalRupiah,
    totalCogsRupiah: 0,
    grossProfitRupiah: lineTotalRupiah,
    status: 'COMPLETED',
    items: [{ productId: product.id, productName: product.name, weightGram, effectivePricePerKg: pricePerKg, lineTotalRupiah, movingAvgHppPerKg: product.movingAvgHppPerKg }],
    lotAllocations: [],
  } as any];
  return state;
}

function configureOwnerPinForTests(state: BusinessEngineState): BusinessEngineState {
  const result = updateOwnerPin(state, '123456', '654321', 'Owner Test');
  if (!result.ok) throw new Error(result.message);
  return result.state;
}

function makeLot(overrides: Partial<BatchLotEntity> = {}): BatchLotEntity {
  return {
    id: 'LOT_A1',
    code: 'LOT-A-01',
    product: 'Ribeye Meltique Australia',
    productId: 'PROD_A',
    daysLeft: 14,
    expiryDate: '2026-12-01',
    weightGram: 10000,
    maxCapacityGram: 50000,
    hppKgRupiah: 180000,
    loc: 'FREEZER-A-01',
    isFefo: false,
    isQuarantined: false,
    ...overrides,
  };
}

function makeCustomer(overrides: Partial<CustomerEntity> = {}): CustomerEntity {
  return {
    id: 'CUST_01',
    code: 'CUST-01',
    name: 'Hotel Grand Serang',
    tier: 'HOREKA',
    creditLimit: 25000000,
    currentReceivable: 1000000,
    termDays: 14,
    phone: '0812-0000-1111',
    address: 'Serang',
    ...overrides,
  };
}

function makeState(params?: {
  products?: ProductEntity[];
  lots?: BatchLotEntity[];
  customers?: CustomerEntity[];
}): BusinessEngineState {
  return createSeededEngineState({
    products: params?.products ?? [makeProduct()],
    lots: params?.lots ?? [makeLot()],
    customers: params?.customers ?? [makeCustomer()],
    receivables: [],
    inboundPOs: [],
    supplierInvoices: [],
  });
}

// ============================================================================
// 1. PENJUALAN DENGAN 1 LOT CUKUP
// ============================================================================
test('1. Penjualan dengan 1 lot cukup memotong lot dan mencatat ledger 1-to-1', () => {
  const prod = makeProduct({ id: 'PROD_01', stockGram: 10000 });
  const lot = makeLot({ id: 'LOT_01', code: 'LOT-01', productId: 'PROD_01', weightGram: 10000, hppKgRupiah: 180000 });
  const state = makeState({ products: [prod], lots: [lot] });

  const res = commitSaleTransaction(state, {
    idempotencyKey: 'SALE-SINGLE-LOT-1',
    customerId: 'CUST_01',
    paymentMethod: 'CASH',
    isFreeShipping: true,
    shippingFee: 25000,
    cashTendered: 1075000,
    items: [{ product: prod, weightGram: 5000, effectivePricePerKg: 215000 }],
    isOnline: false,
  });

  assert.equal(res.ok, true);
  assert.ok(res.createdInvoice);
  assert.equal(res.createdInvoice.grandTotalRupiah, 1075000);
  assert.equal(res.state.lots.find((l) => l.id === 'LOT_01')?.weightGram, 5000);
  assert.equal(res.state.products.find((p) => p.id === 'PROD_01')?.stockGram, 5000);
  assert.equal(res.createdInvoice.lotAllocations.length, 1);
  assert.equal(res.createdInvoice.lotAllocations[0].lotId, 'LOT_01');
  assert.equal(res.createdInvoice.lotAllocations[0].weightGram, 5000);

  const saleLedger = res.state.stockLedger.filter((e) => e.referenceNo === res.createdInvoice!.invoiceNumber);
  assert.equal(saleLedger.length, 1);
  assert.equal(saleLedger[0].type, 'OUT_SALE');
  assert.equal(saleLedger[0].lotId, 'LOT_01');
  assert.equal(saleLedger[0].weightGramDelta, -5000);
});

// ============================================================================
// 2. PENJUALAN LINTAS BANYAK LOT
// ============================================================================
test('2. Penjualan lintas banyak lot membagi alokasi, COGS, dan ledger secara akurat', () => {
  const prod = makeProduct({ id: 'PROD_01', stockGram: 7000 });
  const lots = [
    makeLot({ id: 'LOT_1', code: 'LOT-1', productId: 'PROD_01', expiryDate: '2026-11-15', weightGram: 3000, hppKgRupiah: 170000 }),
    makeLot({ id: 'LOT_2', code: 'LOT-2', productId: 'PROD_01', expiryDate: '2026-11-25', weightGram: 4000, hppKgRupiah: 190000 }),
  ];
  const state = makeState({ products: [prod], lots });

  const res = commitSaleTransaction(state, {
    idempotencyKey: 'SALE-MULTI-LOT-1',
    customerId: 'CUST_01',
    paymentMethod: 'TRANSFER',
    isFreeShipping: true,
    shippingFee: 0,
    cashTendered: 0,
    items: [{ product: prod, weightGram: 5500, effectivePricePerKg: 215000 }],
    isOnline: true,
  });

  assert.equal(res.ok, true);
  assert.equal(res.state.lots.find((l) => l.id === 'LOT_1')?.weightGram, 0);
  assert.equal(res.state.lots.find((l) => l.id === 'LOT_2')?.weightGram, 1500);
  assert.equal(res.state.products.find((p) => p.id === 'PROD_01')?.stockGram, 1500);

  const allocs = res.createdInvoice!.lotAllocations;
  assert.equal(allocs.length, 2);
  assert.deepEqual(
    allocs.map((a) => ({ lotId: a.lotId, weightGram: a.weightGram })),
    [
      { lotId: 'LOT_1', weightGram: 3000 },
      { lotId: 'LOT_2', weightGram: 2500 },
    ]
  );

  const expectedCogs = Math.round((3000 * 170000) / 1000) + Math.round((2500 * 190000) / 1000);
  assert.equal(res.createdInvoice!.totalCogsRupiah, expectedCogs);

  const saleLedger = res.state.stockLedger.filter((e) => e.referenceNo === res.createdInvoice!.invoiceNumber);
  assert.equal(saleLedger.length, 2);
  assert.equal(saleLedger.reduce((s, e) => s + e.weightGramDelta, 0), -5500);
});

// ============================================================================
// 3. URUTAN ALOKASI FEFO DETERMINISTIK BERDASARKAN EXPIRY DATE AKTUAL
// ============================================================================
test('3. Urutan alokasi FEFO memakai expiryDate aktual meskipun urutan array dan daysLeft tidak urut', () => {
  const lots: BatchLotEntity[] = [
    makeLot({ id: 'LOT_FAR', code: 'LOT-Z', productId: 'PROD_01', expiryDate: '2026-12-20', daysLeft: 1, weightGram: 5000 }),
    makeLot({ id: 'LOT_TIE_B', code: 'LOT-B', productId: 'PROD_01', expiryDate: '2026-11-18', daysLeft: 10, weightGram: 2000 }),
    makeLot({ id: 'LOT_TIE_A', code: 'LOT-A', productId: 'PROD_01', expiryDate: '2026-11-18', daysLeft: 10, weightGram: 2000 }),
    makeLot({ id: 'LOT_EARLIEST', code: 'LOT-E', productId: 'PROD_01', expiryDate: '2026-11-15', daysLeft: 99, weightGram: 2000 }),
  ];

  const fefo = allocateLotsFEFO(lots, { productId: 'PROD_01' }, 5000, 0, new Date(2026, 10, 13, 9, 0, 0));
  assert.equal(fefo.shortGram, 0);
  assert.deepEqual(
    fefo.allocations.map((a) => ({ lotId: a.lotId, weightGram: a.weightGram })),
    [
      { lotId: 'LOT_EARLIEST', weightGram: 2000 },
      { lotId: 'LOT_TIE_A', weightGram: 2000 },
      { lotId: 'LOT_TIE_B', weightGram: 1000 },
    ]
  );
  assert.equal(fefo.updatedLots.find((l) => l.id === 'LOT_FAR')?.weightGram, 5000);
});

// ============================================================================
// 4. DUA PRODUK BERBEDA DENGAN NAMA YANG SAMA
// ============================================================================
test('4. Dua produk berbeda dengan nama identik diisolasi ketat lewat productId', () => {
  const prodA = makeProduct({ id: 'PROD_A', sku: 'SKU-A', name: 'Daging Sapi Premium', stockGram: 2000 });
  const prodB = makeProduct({ id: 'PROD_B', sku: 'SKU-B', name: 'Daging Sapi Premium', stockGram: 10000 });
  const lotA = makeLot({ id: 'LOT_A', code: 'LOT-A', productId: 'PROD_A', product: 'Daging Sapi Premium', weightGram: 2000 });
  const lotB = makeLot({ id: 'LOT_B', code: 'LOT-B', productId: 'PROD_B', product: 'Daging Sapi Premium', weightGram: 10000 });
  const state = makeState({ products: [prodA, prodB], lots: [lotA, lotB] });

  assert.equal(getProductAvailableStockGram(state.lots, 'PROD_A', prodA.name), 2000);
  assert.equal(getProductAvailableStockGram(state.lots, 'PROD_B', prodB.name), 10000);

  // Mencoba beli 3kg PROD_A harus ditolak (tidak boleh mengambil stok LOT_B meskipun namanya sama)
  const overRes = commitSaleTransaction(state, {
    idempotencyKey: 'SALE-SAME-NAME-OVER',
    customerId: 'CUST_01',
    paymentMethod: 'CASH',
    isFreeShipping: true,
    shippingFee: 0,
    cashTendered: 720000,
    items: [{ product: prodA, weightGram: 3000, effectivePricePerKg: 240000 }],
    isOnline: true,
  });
  assert.equal(overRes.ok, false);
  assert.equal(overRes.errorCode, 'VALIDATION');
  assert.deepStrictEqual(overRes.state, state);

  // Beli 1.5kg PROD_A hanya memotong LOT_A, LOT_B tetap utuh 10000g
  const validRes = commitSaleTransaction(state, {
    idempotencyKey: 'SALE-SAME-NAME-OK',
    customerId: 'CUST_01',
    paymentMethod: 'CASH',
    isFreeShipping: true,
    shippingFee: 0,
    cashTendered: 322500,
    items: [{ product: prodA, weightGram: 1500, effectivePricePerKg: 215000 }],
    isOnline: true,
  });
  assert.equal(validRes.ok, true);
  assert.equal(validRes.state.lots.find((l) => l.id === 'LOT_A')?.weightGram, 500);
  assert.equal(validRes.state.lots.find((l) => l.id === 'LOT_B')?.weightGram, 10000);
});

// ============================================================================
// 5. LOT TIDAK LAYAK (KARANTINA, BERAT 0, BERAT NEGATIF, PRODUCT ID BERBEDA)
// ============================================================================
test('5. Lot karantina, berat 0, berat negatif, dan produk lain diabaikan pada alokasi stok', () => {
  const prod = makeProduct({ id: 'PROD_01' });
  const lots: BatchLotEntity[] = [
    makeLot({ id: 'LOT_QUAR', productId: 'PROD_01', expiryDate: '2026-11-01', weightGram: 50000, isQuarantined: true }),
    makeLot({ id: 'LOT_ZERO', productId: 'PROD_01', expiryDate: '2026-11-02', weightGram: 0 }),
    makeLot({ id: 'LOT_NEG', productId: 'PROD_01', expiryDate: '2026-11-03', weightGram: -1000 }),
    makeLot({ id: 'LOT_OTHER', productId: 'PROD_OTHER', expiryDate: '2026-11-04', weightGram: 25000 }),
    makeLot({ id: 'LOT_OK', productId: 'PROD_01', expiryDate: '2026-11-20', weightGram: 4000 }),
  ];
  const state = makeState({ products: [prod], lots });

  assert.equal(getProductAvailableStockGram(state.lots, 'PROD_01'), 4000);

  const failRes = commitSaleTransaction(state, {
    idempotencyKey: 'SALE-INELIGIBLE-FAIL',
    customerId: 'CUST_01',
    paymentMethod: 'CASH',
    isFreeShipping: true,
    shippingFee: 0,
    cashTendered: 1200000,
    items: [{ product: prod, weightGram: 5000, effectivePricePerKg: 240000 }],
    isOnline: true,
  });
  assert.equal(failRes.ok, false);

  const okRes = commitSaleTransaction(state, {
    idempotencyKey: 'SALE-INELIGIBLE-OK',
    customerId: 'CUST_01',
    paymentMethod: 'CASH',
    isFreeShipping: true,
    shippingFee: 0,
    cashTendered: 645000,
    items: [{ product: prod, weightGram: 3000, effectivePricePerKg: 215000 }],
    isOnline: true,
  });
  assert.equal(okRes.ok, true);
  assert.equal(okRes.state.lots.find((l) => l.id === 'LOT_OK')?.weightGram, 1000);
  assert.equal(okRes.state.lots.find((l) => l.id === 'LOT_QUAR')?.weightGram, 50000);
  assert.equal(okRes.state.lots.find((l) => l.id === 'LOT_NEG')?.weightGram, -1000);
  assert.equal(okRes.state.lots.find((l) => l.id === 'LOT_OTHER')?.weightGram, 25000);
});

// ============================================================================
// 6. STOK TIDAK MENCUKUPI (TERMASUK 2 BARIS PRODUK SAMA DI 1 KERANJANG)
// ============================================================================
test('6. Stok tidak mencukupi (single item dan akumulasi 2 baris produk yang sama) ditolak', () => {
  const prod = makeProduct({ id: 'PROD_01', stockGram: 4000 });
  const lot = makeLot({ id: 'LOT_01', productId: 'PROD_01', weightGram: 4000 });
  const state = makeState({ products: [prod], lots: [lot] });

  const singleOver = commitSaleTransaction(state, {
    idempotencyKey: 'SALE-SHORT-1',
    customerId: 'CUST_01',
    paymentMethod: 'CASH',
    isFreeShipping: true,
    shippingFee: 0,
    cashTendered: 1000000,
    items: [{ product: prod, weightGram: 4001, effectivePricePerKg: 240000 }],
    isOnline: true,
  });
  assert.equal(singleOver.ok, false);
  assert.equal(singleOver.errorCode, 'VALIDATION');

  const splitLineOver = commitSaleTransaction(state, {
    idempotencyKey: 'SALE-SHORT-SPLIT',
    customerId: 'CUST_01',
    paymentMethod: 'CASH',
    isFreeShipping: true,
    shippingFee: 0,
    cashTendered: 1200000,
    items: [
      { product: prod, weightGram: 2500, effectivePricePerKg: 240000 },
      { product: prod, weightGram: 2500, effectivePricePerKg: 240000 },
    ],
    isOnline: true,
  });
  assert.equal(splitLineOver.ok, false);
  assert.equal(splitLineOver.errorCode, 'VALIDATION');
  assert.deepStrictEqual(splitLineOver.state, state);
});

// ============================================================================
// 7. TRANSAKSI DITOLAK TIDAK MENGUBAH STATE (ZERO PARTIAL MUTATION / VIRTUAL LOT)
// ============================================================================
test('7. Transaksi ditolak di item ke-2 atau saat validasi pembayaran tidak mengubah state sama sekali', () => {
  const prod1 = makeProduct({ id: 'PROD_01', name: 'Ribeye', stockGram: 10000 });
  const prod2 = makeProduct({ id: 'PROD_02', name: 'Sirloin', stockGram: 1000 });
  const lot1 = makeLot({ id: 'LOT_01', productId: 'PROD_01', product: 'Ribeye', weightGram: 10000 });
  const lot2 = makeLot({ id: 'LOT_02', productId: 'PROD_02', product: 'Sirloin', weightGram: 1000 });
  const state = makeState({ products: [prod1, prod2], lots: [lot1, lot2] });
  const snapshotBefore = structuredClone(state);

  const rejectedRes = commitSaleTransaction(state, {
    idempotencyKey: 'SALE-PARTIAL-REJECT',
    customerId: 'CUST_01',
    paymentMethod: 'CASH',
    isFreeShipping: true,
    shippingFee: 0,
    cashTendered: 5000000,
    items: [
      { product: prod1, weightGram: 5000, effectivePricePerKg: 215000 },
      { product: prod2, weightGram: 2000, effectivePricePerKg: 190000 },
    ],
    isOnline: true,
  });

  assert.equal(rejectedRes.ok, false);
  assert.deepStrictEqual(rejectedRes.state, snapshotBefore);
  assert.equal(rejectedRes.state.transactions.length, 0);
  assert.equal(rejectedRes.state.stockLedger.some((e) => e.lotId === 'CATALOG-STOCK'), false);
});

// ============================================================================
// 8. PENGURANGAN STOK SAMA PERSIS DENGAN JUMLAH TERJUAL & PEMBALIKAN VOID
// ============================================================================
test('8. Pengurangan stok sama persis dengan jumlah terjual dan void mengembalikan stok + ledger 1-to-1', () => {
  const prod = makeProduct({ id: 'PROD_01', stockGram: 9000 });
  const lots = [
    makeLot({ id: 'LOT_1', code: 'LOT-1', productId: 'PROD_01', expiryDate: '2026-11-16', weightGram: 4000, hppKgRupiah: 175000 }),
    makeLot({ id: 'LOT_2', code: 'LOT-2', productId: 'PROD_01', expiryDate: '2026-11-22', weightGram: 5000, hppKgRupiah: 185000 }),
  ];
  const state = makeState({ products: [prod], lots });
  const soldGram = 6500;

  const saleRes = commitSaleTransaction(state, {
    idempotencyKey: 'SALE-EXACT-DEDUCT',
    customerId: 'CUST_01',
    paymentMethod: 'CASH',
    isFreeShipping: true,
    shippingFee: 0,
    cashTendered: 1500000,
    items: [{ product: prod, weightGram: soldGram, effectivePricePerKg: 215000 }],
    isOnline: true,
  });
  assert.equal(saleRes.ok, true);

  const totalAfterSale = saleRes.state.lots.reduce((s, l) => s + l.weightGram, 0);
  assert.equal(9000 - totalAfterSale, soldGram);
  assert.equal(saleRes.state.products[0].stockGram, 9000 - soldGram);

  const voidRes = voidSaleTransaction(
    configureOwnerPinForTests(saleRes.state),
    saleRes.createdInvoice!.uuid,
    'Salah input pelanggan',
    'Pemilik Usaha',
    true,
    undefined,
    { ownerPin: '654321' }
  );
  assert.equal(voidRes.ok, true);
  assert.equal(voidRes.state.lots.find((l) => l.id === 'LOT_1')?.weightGram, 4000);
  assert.equal(voidRes.state.lots.find((l) => l.id === 'LOT_2')?.weightGram, 5000);
  assert.equal(voidRes.state.products[0].stockGram, 9000);

  const reversalEntries = voidRes.state.stockLedger.filter(
    (e) => e.referenceNo === `VOID-${saleRes.createdInvoice!.invoiceNumber}`
  );
  assert.equal(reversalEntries.length, 2);
  assert.equal(reversalEntries.reduce((s, e) => s + e.weightGramDelta, 0), soldGram);
});

// ============================================================================
// 9. PERHITUNGAN SUBTOTAL, DISKON, ONGKIR, DAN GRAND TOTAL
// ============================================================================
test('9. Perhitungan tier/promo harga, subtotal, diskon, ongkir, grand total, dan keseimbangan jurnal', () => {
  const prod = makeProduct({
    id: 'PROD_01',
    sku: 'SKU-RIBEYE',
    basePricePerKg: 240000,
    tierPrices: { RETAIL: 240000, HOREKA: 215000, VIP: 195000 },
  });

  // Volume break: RETAIL beli 5kg -> naik ke HOREKA; 20kg -> naik ke VIP
  const tier5kg = calculateProductTierPrice(prod, 'RETAIL', 5000, []);
  assert.equal(tier5kg.effectivePricePerKg, 215000);
  assert.equal(tier5kg.isVolumeUpgrade, true);

  const tier20kg = calculateProductTierPrice(prod, 'RETAIL', 20000, []);
  assert.equal(tier20kg.effectivePricePerKg, 195000);

  const refNow = new Date(2026, 10, 13, 10, 0, 0);
  const promoPrice = calculateProductTierPrice(
    prod,
    'RETAIL',
    2000,
    [
      {
        id: 'P1',
        sku: 'SKU-RIBEYE',
        promoPricePerKg: 185000,
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        quotaKg: 50,
        soldKg: 10,
        isActive: true,
        badgeLabel: 'Flash Sale',
      },
    ],
    refNow
  );
  assert.equal(promoPrice.effectivePricePerKg, 185000);
  assert.equal(promoPrice.isPromo, true);
  assert.equal(promoPrice.appliedPromoId, 'P1');

  // Transaksi 2 item + diskon faktur + ongkir berbayar
  const prod2 = makeProduct({ id: 'PROD_02', sku: 'SKU-SIR', name: 'Sirloin', stockGram: 10000 });
  const lot1 = makeLot({ id: 'LOT_1', productId: 'PROD_01', weightGram: 10000 });
  const lot2 = makeLot({ id: 'LOT_2', productId: 'PROD_02', product: 'Sirloin', weightGram: 10000 });
  const sirloinPromo: BazarPromoEntity = {
    id: 'PROMO_SIR', sku: 'SKU-SIR', promoPricePerKg: 185000,
    startDate: '2026-11-01', endDate: '2026-11-30', quotaKg: 10, soldKg: 0,
    isActive: true, badgeLabel: 'Promo Sirloin',
  };
  const state = createSeededEngineState({
    products: [prod, prod2], lots: [lot1, lot2], customers: [makeCustomer()],
    receivables: [], inboundPOs: [], supplierInvoices: [], bazarPromos: [sirloinPromo],
  });
  const configuredState = configureOwnerPinForTests(state);

  // Item 1: 1250g @ 215.000 = 268.750; Item 2: 2500g @ 185.000 = 462.500 -> subtotal = 731.250
  // Diskon = 31.250, ongkir = 25.000 -> grandTotal = 731.250 - 31.250 + 25.000 = 725.000
  const res = commitSaleTransaction(configuredState, {
    idempotencyKey: 'SALE-TOTAL-CALC',
    customerId: 'CUST_01',
    paymentMethod: 'CASH',
    isFreeShipping: false,
    shippingFee: 25000,
    discountRupiah: 31250,
    ownerPin: '654321',
    cashTendered: 750000,
    items: [
      { product: prod, weightGram: 1250, effectivePricePerKg: 215000 },
      { product: prod2, weightGram: 2500, effectivePricePerKg: 185000, appliedPromoId: 'PROMO_SIR' },
    ],
    isOnline: true,
  });

  assert.equal(res.ok, true);
  assert.equal(res.createdInvoice!.subtotalRupiah, 731250);
  assert.equal(res.createdInvoice!.discountRupiah, 31250);
  assert.equal(res.createdInvoice!.shippingFee, 25000);
  assert.equal(res.createdInvoice!.grandTotalRupiah, 725000);
  assert.equal(res.createdInvoice!.changeRupiah, 25000);
  assert.equal(res.state.journals[0].isBalanced, true);
});

// ============================================================================
// 10. PEMBAYARAN (CASH / TRANSFER / TEMPO + DP) & SISA TAGIHAN
// ============================================================================
test('10. Pembayaran CASH, TRANSFER, dan TEMPO (dengan & tanpa DP) menghitung sisa tagihan & piutang dengan benar', () => {
  const prod = makeProduct({ id: 'PROD_01', stockGram: 30000 });
  const lot = makeLot({ id: 'LOT_01', productId: 'PROD_01', weightGram: 30000 });
  const customer = makeCustomer({ id: 'CUST_01', creditLimit: 25000000, currentReceivable: 1000000 });
  const state = makeState({ products: [prod], lots: [lot], customers: [customer] });

  // TEMPO dengan DP Rp 200.000 dari grand total Rp 1.075.000 -> sisa tagihan Rp 875.000
  const tempoRes = commitSaleTransaction(state, {
    idempotencyKey: 'SALE-TEMPO-DP',
    customerId: 'CUST_01',
    paymentMethod: 'TEMPO',
    isFreeShipping: true,
    shippingFee: 0,
    cashTendered: 200000,
    paidAmountRupiah: 200000,
    items: [{ product: prod, weightGram: 5000, effectivePricePerKg: 215000 }],
    isOnline: true,
  });

  assert.equal(tempoRes.ok, true);
  assert.equal(tempoRes.createdInvoice!.grandTotalRupiah, 1075000);
  assert.equal(tempoRes.createdInvoice!.paidAmountRupiah, 200000);
  assert.equal(tempoRes.createdInvoice!.balanceDueRupiah, 875000);
  assert.equal(tempoRes.state.cashInHandRupiah, state.cashInHandRupiah + 200000);
  assert.equal(tempoRes.state.customers[0].currentReceivable, 1000000 + 875000);
  assert.equal(tempoRes.state.receivables[0].amount, 875000);
  assert.equal(tempoRes.state.journals[0].isBalanced, true);

  // Void TEMPO dengan DP harus membalik kas DP 200rb DAN piutang 875rb secara seimbang
  const voidTempo = voidSaleTransaction(configureOwnerPinForTests(tempoRes.state), tempoRes.createdInvoice!.uuid, 'Batal DP', 'Owner', true, undefined, { ownerPin: '654321' });
  assert.equal(voidTempo.ok, true);
  assert.equal(voidTempo.state.cashInHandRupiah, state.cashInHandRupiah);
  assert.equal(voidTempo.state.customers[0].currentReceivable, 1000000);
  assert.equal(voidTempo.state.journals[0].isBalanced, true);

  // TEMPO melebihi plafon tetap bisa checkout; plafon hanya warning
  const smallCust = makeCustomer({ id: 'CUST_SMALL', creditLimit: 500000, currentReceivable: 400000 });
  const stateSmall = makeState({ products: [prod], lots: [lot], customers: [smallCust] });
  const blockedTempo = commitSaleTransaction(stateSmall, {
    idempotencyKey: 'SALE-TEMPO-OVER-LIMIT',
    customerId: 'CUST_SMALL',
    paymentMethod: 'TEMPO',
    isFreeShipping: true,
    shippingFee: 0,
    cashTendered: 0,
    items: [{ product: prod, weightGram: 2000, effectivePricePerKg: 215000 }],
    isOnline: true,
  });
  assert.equal(blockedTempo.ok, true);
  assert.match(blockedTempo.message, /warning saja/i);
  assert.equal(blockedTempo.state.lots[0].weightGram, 28000);
});

// ============================================================================
// 11. INPUT TIDAK VALID (0, NEGATIF, NaN, INFINITY, FLOAT, KURANG BAYAR, DLL)
// ============================================================================
test('11. Input 0, negatif, NaN, Infinity, float, diskon > subtotal, dan kurang bayar ditolak aman tanpa mutasi', () => {
  const prod = makeProduct({ id: 'PROD_01', stockGram: 10000 });
  const lot = makeLot({ id: 'LOT_01', productId: 'PROD_01', weightGram: 10000 });
  const state = makeState({ products: [prod], lots: [lot] });

  const invalidCases: Array<{ label: string; fn: () => ReturnType<typeof commitSaleTransaction> }> = [
    {
      label: 'berat 0 gram',
      fn: () =>
        commitSaleTransaction(state, {
          idempotencyKey: 'INV-0',
          customerId: 'CUST_01',
          paymentMethod: 'CASH',
          isFreeShipping: true,
          shippingFee: 0,
          cashTendered: 0,
          items: [{ product: prod, weightGram: 0, effectivePricePerKg: 240000 }],
          isOnline: true,
        }),
    },
    {
      label: 'berat negatif',
      fn: () =>
        commitSaleTransaction(state, {
          idempotencyKey: 'INV-NEG',
          customerId: 'CUST_01',
          paymentMethod: 'CASH',
          isFreeShipping: true,
          shippingFee: 0,
          cashTendered: 0,
          items: [{ product: prod, weightGram: -500, effectivePricePerKg: 240000 }],
          isOnline: true,
        }),
    },
    {
      label: 'berat NaN',
      fn: () =>
        commitSaleTransaction(state, {
          idempotencyKey: 'INV-NAN',
          customerId: 'CUST_01',
          paymentMethod: 'CASH',
          isFreeShipping: true,
          shippingFee: 0,
          cashTendered: 100000,
          items: [{ product: prod, weightGram: Number.NaN, effectivePricePerKg: 240000 }],
          isOnline: true,
        }),
    },
    {
      label: 'berat Infinity',
      fn: () =>
        commitSaleTransaction(state, {
          idempotencyKey: 'INV-INF',
          customerId: 'CUST_01',
          paymentMethod: 'CASH',
          isFreeShipping: true,
          shippingFee: 0,
          cashTendered: 100000,
          items: [{ product: prod, weightGram: Number.POSITIVE_INFINITY, effectivePricePerKg: 240000 }],
          isOnline: true,
        }),
    },
    {
      label: 'berat pecahan desimal',
      fn: () =>
        commitSaleTransaction(state, {
          idempotencyKey: 'INV-FLOAT',
          customerId: 'CUST_01',
          paymentMethod: 'CASH',
          isFreeShipping: true,
          shippingFee: 0,
          cashTendered: 500000,
          items: [{ product: prod, weightGram: 1250.5, effectivePricePerKg: 240000 }],
          isOnline: true,
        }),
    },
    {
      label: 'harga 0',
      fn: () =>
        commitSaleTransaction(state, {
          idempotencyKey: 'INV-PRICE-0',
          customerId: 'CUST_01',
          paymentMethod: 'CASH',
          isFreeShipping: true,
          shippingFee: 0,
          cashTendered: 0,
          items: [{ product: prod, weightGram: 1000, effectivePricePerKg: 0 }],
          isOnline: true,
        }),
    },
    {
      label: 'diskon melebihi subtotal',
      fn: () =>
        commitSaleTransaction(state, {
          idempotencyKey: 'INV-DISC-OVER',
          customerId: 'CUST_01',
          paymentMethod: 'CASH',
          isFreeShipping: true,
          shippingFee: 0,
          discountRupiah: 250000,
          cashTendered: 0,
          items: [{ product: prod, weightGram: 1000, effectivePricePerKg: 240000 }],
          isOnline: true,
        }),
    },
    {
      label: 'tunai kurang dari total',
      fn: () =>
        commitSaleTransaction(state, {
          idempotencyKey: 'INV-CASH-SHORT',
          customerId: 'CUST_01',
          paymentMethod: 'CASH',
          isFreeShipping: true,
          shippingFee: 0,
          cashTendered: 200000,
          items: [{ product: prod, weightGram: 1000, effectivePricePerKg: 240000 }],
          isOnline: true,
        }),
    },
    {
      label: 'pelanggan tidak terdaftar',
      fn: () =>
        commitSaleTransaction(state, {
          idempotencyKey: 'INV-NO-CUST',
          customerId: 'CUST_UNKNOWN',
          paymentMethod: 'CASH',
          isFreeShipping: true,
          shippingFee: 0,
          cashTendered: 240000,
          items: [{ product: prod, weightGram: 1000, effectivePricePerKg: 240000 }],
          isOnline: true,
        }),
    },
    {
      label: 'produk tidak terdaftar',
      fn: () =>
        commitSaleTransaction(state, {
          idempotencyKey: 'INV-NO-PROD',
          customerId: 'CUST_01',
          paymentMethod: 'CASH',
          isFreeShipping: true,
          shippingFee: 0,
          cashTendered: 240000,
          items: [{ product: { ...prod, id: 'PROD_UNKNOWN' }, weightGram: 1000, effectivePricePerKg: 240000 }],
          isOnline: true,
        }),
    },
    {
      label: 'idempotencyKey kosong',
      fn: () =>
        commitSaleTransaction(state, {
          idempotencyKey: '   ',
          customerId: 'CUST_01',
          paymentMethod: 'CASH',
          isFreeShipping: true,
          shippingFee: 0,
          cashTendered: 240000,
          items: [{ product: prod, weightGram: 1000, effectivePricePerKg: 240000 }],
          isOnline: true,
        }),
    },
  ];

  for (const c of invalidCases) {
    const res = c.fn();
    assert.equal(res.ok, false, `Seharusnya ditolak untuk kasus: ${c.label}`);
    assert.deepStrictEqual(res.state, state, `State berubah pada kasus ditolak: ${c.label}`);
  }

  // Retur berat <= 0 atau NaN juga harus ditolak
  const badReturn = executeCustomerReturn(state, {
    customerName: 'Hotel Grand Serang',
    invoiceNo: 'INV-01',
    productName: 'Ribeye Meltique Australia',
    weightGram: 0,
    reason: 'Rusak',
    resolution: 'CREDIT_NOTE',
  });
  assert.equal(badReturn.ok, false);
  assert.deepStrictEqual(badReturn.state, state);
});

// ============================================================================
// 12. KEPUTUSAN 1 & 2: LOT MELEWATI EXPIRY DATE OTOMATIS TIDAK BISA DIJUAL
// ============================================================================
test('12. Lot yang melewati expiryDate otomatis diabaikan FEFO & ditolak saat checkout tanpa stok minus atau virtual lot', () => {
  const refDate = new Date(2026, 10, 13, 12, 0, 0); // 2026-11-13 lokal
  const prod = makeProduct({ id: 'PROD_01', stockGram: 15000 });
  const expiredLot = makeLot({
    id: 'LOT_EXP',
    code: 'LOT-EXP-10',
    productId: 'PROD_01',
    expiryDate: '2026-11-10',
    weightGram: 10000,
    isQuarantined: false,
  });
  const todayLot = makeLot({
    id: 'LOT_TODAY',
    code: 'LOT-TODAY-13',
    productId: 'PROD_01',
    expiryDate: '2026-11-13',
    weightGram: 5000,
    isQuarantined: false,
  });

  assert.equal(isLotExpired(expiredLot, refDate), true);
  assert.equal(isLotExpired(todayLot, refDate), false);
  assert.equal(getProductAvailableStockGram([expiredLot, todayLot], 'PROD_01', prod.name, refDate), 5000);

  // Jika ada lot kadaluwarsa dan lot aktif hari ini, FEFO hanya mengalokasikan lot aktif
  const stateMixed = makeState({ products: [prod], lots: [expiredLot, todayLot] });
  const okSale = commitSaleTransaction(stateMixed, {
    idempotencyKey: 'SALE-SKIP-EXPIRED',
    customerId: 'CUST_01',
    paymentMethod: 'CASH',
    isFreeShipping: true,
    shippingFee: 0,
    cashTendered: 1075000,
    items: [{ product: prod, weightGram: 5000, effectivePricePerKg: 215000 }],
    now: refDate,
    isOnline: true,
  });
  assert.equal(okSale.ok, true);
  assert.equal(okSale.createdInvoice!.lotAllocations[0].lotId, 'LOT_TODAY');
  assert.equal(okSale.state.lots.find((l) => l.id === 'LOT_EXP')?.weightGram, 10000);
  assert.equal(okSale.state.lots.find((l) => l.id === 'LOT_TODAY')?.weightGram, 0);
  assert.equal(okSale.state.products[0].stockGram, 0);

  // Jika hanya tersisa lot kadaluwarsa, penjualan ditolak keras tanpa stok minus maupun virtual lot
  const onlyExpiredState = makeState({ products: [prod], lots: [expiredLot] });
  const rejected = commitSaleTransaction(onlyExpiredState, {
    idempotencyKey: 'SALE-ONLY-EXPIRED',
    customerId: 'CUST_01',
    paymentMethod: 'CASH',
    isFreeShipping: true,
    shippingFee: 0,
    cashTendered: 240000,
    items: [{ product: prod, weightGram: 1000, effectivePricePerKg: 240000 }],
    now: refDate,
    isOnline: true,
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.errorCode, 'VALIDATION');
  assert.deepStrictEqual(rejected.state, onlyExpiredState);
  assert.equal(rejected.state.stockLedger.some((e) => e.lotId === 'CATALOG-STOCK'), false);
});

// ============================================================================
// 13. KEPUTUSAN 3: RESTO & CATERING MENGGUNAKAN HARGA HOREKA
// ============================================================================
test('13. Pelanggan tier RESTO dan CATERING menggunakan harga tier HOREKA (serta upgrade VIP >= 20kg)', () => {
  const prod = makeProduct({
    id: 'PROD_01',
    basePricePerKg: 240000,
    tierPrices: { RETAIL: 240000, HOREKA: 215000, VIP: 195000 },
  });

  const restoPrice = calculateProductTierPrice(prod, 'RESTO', 2000, []);
  assert.equal(restoPrice.effectivePricePerKg, 215000);
  assert.equal(restoPrice.activeTier, 'HOREKA');
  assert.equal(restoPrice.isVolumeUpgrade, false);

  const cateringPrice = calculateProductTierPrice(prod, 'CATERING', 1500, []);
  assert.equal(cateringPrice.effectivePricePerKg, 215000);
  assert.equal(cateringPrice.activeTier, 'HOREKA');

  const cateringLower = calculateProductTierPrice(prod, 'catering', 1000, []);
  assert.equal(cateringLower.effectivePricePerKg, 215000);

  const resto20kg = calculateProductTierPrice(prod, 'RESTO', 20000, []);
  assert.equal(resto20kg.effectivePricePerKg, 195000);
  assert.equal(resto20kg.activeTier, 'VIP');
  assert.equal(resto20kg.isVolumeUpgrade, true);
});

// ============================================================================
// 14. KEPUTUSAN 4: PROMO BAZAR (STATUS, PERIODE TANGGAL, KUOTA)
// ============================================================================
test('14. Promo bazar memeriksa status, periode tanggal, sisa kuota, dan kuota hanya berkurang bila transaksi berhasil', () => {
  const refNow = new Date(2026, 10, 13, 14, 0, 0); // 2026-11-13 14:00
  const prod = makeProduct({
    id: 'PROD_01',
    sku: 'SKU-RIBEYE-AUS',
    basePricePerKg: 240000,
    tierPrices: { RETAIL: 240000, HOREKA: 215000, VIP: 195000 },
    stockGram: 20000,
  });
  const lot = makeLot({
    id: 'LOT_01',
    productId: 'PROD_01',
    expiryDate: '2026-11-25',
    weightGram: 20000,
  });
  const cust = makeCustomer({ id: 'CUST_01', tier: 'RETAIL', creditLimit: 500000, currentReceivable: 400000 });

  const makePromo = (overrides: Partial<BazarPromoEntity> = {}): BazarPromoEntity => ({
    id: 'PROMO_ACTIVE',
    sku: 'SKU-RIBEYE-AUS',
    promoPricePerKg: 199000,
    startDate: '2026-11-10 00:00',
    endDate: '2026-11-15 23:59',
    quotaKg: 10,
    soldKg: 7,
    isActive: true,
    badgeLabel: 'Flash Bazar',
    ...overrides,
  });

  // 1) Status non-aktif -> tidak berlaku
  assert.equal(isBazarPromoEligible(makePromo({ isActive: false }), 1000, refNow), false);
  // 2) Sebelum startDate -> tidak berlaku
  assert.equal(isBazarPromoEligible(makePromo({ startDate: '2026-11-14 00:00' }), 1000, refNow), false);
  // 3) Melewati endDate -> tidak berlaku
  assert.equal(isBazarPromoEligible(makePromo({ endDate: '2026-11-12 23:59' }), 1000, refNow), false);
  // 4) Sisa kuota 3 kg, pesan 4 kg -> tidak berlaku untuk harga promo
  const overQuotaPricing = calculateProductTierPrice(prod, 'RETAIL', 4000, [makePromo()], refNow);
  assert.equal(overQuotaPricing.isPromo, false);
  assert.equal(overQuotaPricing.effectivePricePerKg, 240000);
  // 5) Sisa kuota 3 kg, pesan 2.5 kg dalam periode -> promo berlaku!
  const validPricing = calculateProductTierPrice(prod, 'RETAIL', 2500, [makePromo()], refNow);
  assert.equal(validPricing.isPromo, true);
  assert.equal(validPricing.effectivePricePerKg, 199000);
  assert.equal(validPricing.appliedPromoId, 'PROMO_ACTIVE');

  // Transaksi GAGAL karena pembayaran kurang -> kuota TIDAK berkurang
  const promos = [makePromo()];
  const state = makeState({ products: [prod], lots: [lot], customers: [cust] });
  state.bazarPromos = promos.map((promo) => ({ ...promo }));
  const failedTempo = commitSaleTransaction(state, {
    idempotencyKey: 'PROMO-FAIL-TEMPO',
    customerId: 'CUST_01',
    paymentMethod: 'CASH',
    isFreeShipping: true,
    shippingFee: 0,
    cashTendered: 0,
    items: [
      {
        product: prod,
        weightGram: 2500,
        effectivePricePerKg: validPricing.effectivePricePerKg,
        appliedPromoId: validPricing.appliedPromoId,
      },
    ],
    now: refNow,
    isOnline: true,
  });
  assert.equal(failedTempo.ok, false);
  assert.equal(failedTempo.errorCode, 'VALIDATION');
  assert.equal(failedTempo.updatedBazarPromos, undefined);
  assert.equal(promos[0].soldKg, 7);

  // 2 baris keranjang sama-sama klaim promo total 3.5 kg (melebihi sisa 3 kg) -> DITOLAK & kuota tetap 7 kg
  const splitOverQuota = commitSaleTransaction(state, {
    idempotencyKey: 'PROMO-SPLIT-OVER',
    customerId: 'CUST_01',
    paymentMethod: 'CASH',
    isFreeShipping: true,
    shippingFee: 0,
    cashTendered: 1000000,
    items: [
      { product: prod, weightGram: 2000, effectivePricePerKg: 199000, appliedPromoId: 'PROMO_ACTIVE' },
      { product: prod, weightGram: 1500, effectivePricePerKg: 199000, appliedPromoId: 'PROMO_ACTIVE' },
    ],
    now: refNow,
    isOnline: true,
  });
  assert.equal(splitOverQuota.ok, false);
  assert.equal(splitOverQuota.errorCode, 'VALIDATION');
  assert.equal(promos[0].soldKg, 7);

  // Transaksi BERHASIL -> kuota berkurang tepat sebesar berat terjual (7 + 2.5 = 9.5 kg)
  const successSale = commitSaleTransaction(state, {
    idempotencyKey: 'PROMO-SUCCESS',
    customerId: 'CUST_01',
    paymentMethod: 'CASH',
    isFreeShipping: true,
    shippingFee: 0,
    cashTendered: 500000,
    items: [
      {
        product: prod,
        weightGram: 2500,
        effectivePricePerKg: validPricing.effectivePricePerKg,
        appliedPromoId: validPricing.appliedPromoId,
      },
    ],
    now: refNow,
    isOnline: true,
  });
  assert.equal(successSale.ok, true);
  assert.ok(successSale.updatedBazarPromos);
  assert.equal(successSale.updatedBazarPromos[0].soldKg, 9.5);
  assert.equal(promos[0].soldKg, 7); // input array asli tidak dimutasi secara langsung
});

// ============================================================================
// 15. PHASE 2: PERSISTENSI DATA PROMO BAZAR SAAT RESTART
// ============================================================================
test('15. Data promo bazar (aktif/non-aktif, promo baru, dan sisa kuota) tetap tersimpan saat aplikasi ditutup dan dibuka kembali', () => {
  const refNow = new Date(2026, 10, 13, 10, 0, 0);
  const store = new Map<string, string>();
  const prevWindow = (globalThis as any).window;
  (globalThis as any).window = {
    localStorage: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    },
  };

  try {
    const prod = makeProduct({
      id: 'PROD_01',
      sku: 'SKU-RIBEYE-AUS',
      basePricePerKg: 240000,
      tierPrices: { RETAIL: 240000, HOREKA: 215000, VIP: 195000 },
      stockGram: 25000,
    });
    const lot = makeLot({ id: 'LOT_01', productId: 'PROD_01', expiryDate: '2026-12-01', weightGram: 25000 });
    const seedPromos: BazarPromoEntity[] = [
      {
        id: 'PROMO_SEED_1',
        sku: 'SKU-RIBEYE-AUS',
        promoPricePerKg: 195000,
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        quotaKg: 30,
        soldKg: 5,
        isActive: true,
        badgeLabel: 'Promo Awal',
      },
    ];
    const seedInput = {
      products: [prod],
      lots: [lot],
      customers: [makeCustomer({ id: 'CUST_01', tier: 'RETAIL' })],
      receivables: [],
      inboundPOs: [],
      supplierInvoices: [],
      bazarPromos: seedPromos,
    };

    let state = loadEngineState(seedInput);
    const createdRes = createBazarPromo(state, {
      id: 'PROMO_NEW_2',
      title: 'Promo Akhir Pekan',
      sku: 'SKU-RIBEYE-AUS',
      productName: prod.name,
      normalPricePerKg: 240000,
      promoPricePerKg: 189000,
      discountRupiahPerKg: 51000,
      discountPercent: 21.3,
      startDate: '2026-11-10',
      endDate: '2026-11-20',
      quotaKg: 20,
      soldKg: 0,
      isActive: true,
      badgeLabel: 'Flash Weekend',
    });
    assert.equal(createdRes.ok, true);
    state = toggleBazarPromo(createdRes.state, 'PROMO_SEED_1').state;

    // Lakukan penjualan memakai PROMO_NEW_2 (3.5 kg)
    const saleRes = commitSaleTransaction(state, {
      idempotencyKey: 'SALE-PERSIST-PROMO-1',
      customerId: 'CUST_01',
      paymentMethod: 'CASH',
      isFreeShipping: true,
      shippingFee: 0,
      cashTendered: 700000,
      items: [
        {
          product: prod,
          weightGram: 3500,
          effectivePricePerKg: 189000,
          appliedPromoId: 'PROMO_NEW_2',
        },
      ],
      now: refNow,
      isOnline: false,
    });
    assert.equal(saleRes.ok, true);

    // Simulasi restart aplikasi: muat ulang state dari storage
    const reloaded = loadEngineState(seedInput);
    const reloadedSeedPromo = reloaded.bazarPromos?.find((p) => p.id === 'PROMO_SEED_1');
    const reloadedNewPromo = reloaded.bazarPromos?.find((p) => p.id === 'PROMO_NEW_2');
    assert.ok(reloadedSeedPromo);
    assert.ok(reloadedNewPromo);
    assert.equal(reloadedSeedPromo.isActive, false);
    assert.equal(reloadedNewPromo.isActive, true);
    assert.equal(reloadedNewPromo.soldKg, 3.5);

    // Simulasi state lama tanpa bazarPromos di-normalisasi dengan backfill fallback
    const legacyRaw = JSON.parse(store.get(ENGINE_STORAGE_KEY)!);
    delete legacyRaw.bazarPromos;
    const backfilled = normalizePersistedState(legacyRaw, seedPromos);
    assert.equal(backfilled.bazarPromos?.length, 1);
    assert.equal(backfilled.bazarPromos?.[0].id, 'PROMO_SEED_1');
  } finally {
    (globalThis as any).window = prevWindow;
  }
});

// ============================================================================
// 16. PHASE 2: VOID TRANSAKSI MENGEMBALIKAN KUOTA PROMO SECARA AKURAT
// ============================================================================
test('16. Void transaksi promo mengembalikan kuota soldKg secara akurat dan void ulang tidak menggandakan kuota', () => {
  const refNow = new Date(2026, 10, 13, 11, 0, 0);
  const prod = makeProduct({
    id: 'PROD_01',
    sku: 'SKU-RIBEYE-AUS',
    basePricePerKg: 240000,
    tierPrices: { RETAIL: 240000, HOREKA: 215000, VIP: 195000 },
    stockGram: 20000,
  });
  const lot = makeLot({ id: 'LOT_01', productId: 'PROD_01', expiryDate: '2026-12-01', weightGram: 20000 });
  const promos: BazarPromoEntity[] = [
    {
      id: 'PROMO_VOID_TEST',
      sku: 'SKU-RIBEYE-AUS',
      promoPricePerKg: 190000,
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      quotaKg: 10,
      soldKg: 4,
      isActive: true,
      badgeLabel: 'Promo Uji Void',
    },
  ];
  const state = createSeededEngineState({
    products: [prod],
    lots: [lot],
    customers: [makeCustomer({ id: 'CUST_01', tier: 'RETAIL' })],
    receivables: [],
    inboundPOs: [],
    supplierInvoices: [],
    bazarPromos: promos,
  });

  const saleRes = commitSaleTransaction(state, {
    idempotencyKey: 'SALE-PROMO-TO-VOID',
    customerId: 'CUST_01',
    paymentMethod: 'CASH',
    isFreeShipping: true,
    shippingFee: 0,
    cashTendered: 500000,
    items: [
      {
        product: prod,
        weightGram: 2250,
        effectivePricePerKg: 190000,
        appliedPromoId: 'PROMO_VOID_TEST',
      },
    ],
    now: refNow,
    isOnline: true,
  });
  assert.equal(saleRes.ok, true);
  assert.equal(saleRes.createdInvoice!.items[0].appliedPromoId, 'PROMO_VOID_TEST');
  assert.equal(saleRes.state.bazarPromos![0].soldKg, 6.25);

  const voidRes = voidSaleTransaction(
    configureOwnerPinForTests(saleRes.state),
    saleRes.createdInvoice!.uuid,
    'Pelanggan batal ambil',
    'Pemilik Usaha',
    true,
    undefined,
    { ownerPin: '654321' }
  );
  assert.equal(voidRes.ok, true);
  assert.equal(voidRes.state.bazarPromos![0].soldKg, 4);
  assert.equal(voidRes.updatedBazarPromos![0].soldKg, 4);

  // Void ulang ditolak & tidak mengembalikan kuota dua kali
  const secondVoid = voidSaleTransaction(
    voidRes.state,
    saleRes.createdInvoice!.uuid,
    'Klik ulang',
    'Pemilik Usaha',
    true,
    undefined,
    { ownerPin: '123456' }
  );
  assert.equal(secondVoid.ok, false);
  assert.equal(secondVoid.errorCode, 'ALREADY_VOIDED');
  assert.equal(secondVoid.state.bazarPromos![0].soldKg, 4);
});

// ============================================================================
// 17. PHASE 2: KONSISTENSI STOK, LOT, DAN LEDGER (TRIMMING, OPNAME, RETUR)
// ============================================================================
test('17. Trimming, stock opname, dan retur pelanggan menjaga konsistensi fisik lot, stok katalog, dan stock ledger', () => {
  const primalProd = makeProduct({ id: 'PROD_01', name: 'Ribeye Meltique AUS (Primal)', stockGram: 20000 });
  const tetelanProd = makeProduct({ id: 'PROD_03', sku: 'SKU-TETELAN-SP', name: 'Tetelan Rawon Super KARKASIA', basePricePerKg: 85000, movingAvgHppPerKg: 65000, stockGram: 5000 });
  const primalLot = makeLot({ id: 'LOT_01', code: 'LOT-01', productId: 'PROD_01', product: primalProd.name, weightGram: 20000, hppKgRupiah: 180000 });
  const tetelanLot = makeLot({ id: 'LOT_03', code: 'LOT-TET-01', productId: 'PROD_03', product: tetelanProd.name, weightGram: 5000, hppKgRupiah: 65000 });
  const cust = makeCustomer({ id: 'CUST_01', name: 'Hotel Grand Serang', currentReceivable: 1000000 });

  let state = createSeededEngineState({
    products: [primalProd, tetelanProd],
    lots: [primalLot, tetelanLot],
    customers: [cust],
    receivables: [
      {
        id: 'REC_01',
        customer: cust.name,
        customerId: cust.id,
        tier: cust.tier,
        amount: 1000000,
        limit: cust.creditLimit,
        dueDate: '2026-11-20',
        category: 'AKAN_DATANG',
        daysDiff: 7,
        invoice: 'INV-001',
        itemsSummary: 'Ribeye',
        phone: cust.phone,
        status: 'BELUM_LUNAS',
      },
    ],
    inboundPOs: [],
    supplierInvoices: [],
  });
  attachCompletedInvoice(state, 'INV-001', cust.id, primalProd, 10000, 240000);

  // A. Trimming 10kg -> 8kg steak + 1.5kg tetelan + 0.5kg susut
  const initialTotalLotGram = state.lots.reduce((s, l) => s + l.weightGram, 0);
  const initialLedgerCount = state.stockLedger.length;
  const trimRes = executeTrimmingConversion(state, {
    sourceLotId: 'LOT_01',
    inputGram: 10000,
    primaryGram: 8000,
    secondaryGram: 1500,
    actorName: 'Staf Potong',
  });
  assert.equal(trimRes.ok, true);
  state = trimRes.state;

  const afterTrimTotalLotGram = state.lots.filter((l) => !l.isQuarantined).reduce((s, l) => s + l.weightGram, 0);
  const newTrimLedgerEntries = state.stockLedger.slice(0, state.stockLedger.length - initialLedgerCount);
  const trimLedgerDelta = newTrimLedgerEntries.reduce((s, e) => s + e.weightGramDelta, 0);
  assert.equal(afterTrimTotalLotGram - initialTotalLotGram, -500);
  assert.equal(trimLedgerDelta, -500);
  assert.equal(state.products.find((p) => p.id === 'PROD_01')?.stockGram, 18000); // 10kg sisa primal + 8kg steak
  assert.equal(state.products.find((p) => p.id === 'PROD_03')?.stockGram, 6500);  // 5kg awal + 1.5kg tetelan
  assert.equal(state.journals[0].isBalanced, true);

  // B. Opname pada LOT_03 (6500g -> 6200g, selisih -300g)
  const opnameRes = executeStockOpname(state, {
    lotId: 'LOT_03',
    physicalWeightGram: 6200,
    reason: 'Susut timbang',
  });
  assert.equal(opnameRes.ok, true);
  state = opnameRes.state;
  assert.equal(state.lots.find((l) => l.id === 'LOT_03')?.weightGram, 6200);
  assert.equal(state.products.find((p) => p.id === 'PROD_03')?.stockGram, 6200);
  assert.equal(state.stockLedger[0].weightGramDelta, -300);

  // C. Retur CREDIT_NOTE 2kg Ribeye: karantina terpisah & TIDAK menambah stok jual, piutang pelanggan berkurang
  const creditRetRes = executeCustomerReturn(state, {
    customerName: 'Hotel Grand Serang',
    invoiceNo: 'INV-001',
    productId: 'PROD_01',
    productName: primalProd.name,
    weightGram: 2000,
    reason: 'Vakum bocor',
    resolution: 'CREDIT_NOTE',
  });
  assert.equal(creditRetRes.ok, true);
  state = creditRetRes.state;
  assert.equal(state.products.find((p) => p.id === 'PROD_01')?.stockGram, 18000); // karantina tidak masuk stok jual
  assert.equal(state.customers[0].currentReceivable, 1000000 - 480000);
  assert.equal(state.receivables[0].amount, 520000);

  // D. Retur TUKAR_BARANG 1.5kg Ribeye: stok jual berkurang via FEFO + karantina tercatat
  const swapRetRes = executeCustomerReturn(state, {
    customerName: 'Hotel Grand Serang',
    invoiceNo: 'INV-001',
    productId: 'PROD_01',
    productName: primalProd.name,
    weightGram: 1500,
    reason: 'Salah potongan',
    resolution: 'TUKAR_BARANG',
  });
  assert.equal(swapRetRes.ok, true);
  state = swapRetRes.state;
  assert.equal(state.products.find((p) => p.id === 'PROD_01')?.stockGram, 16500);
  assert.equal(state.journals[0].isBalanced, true);

  // TUKAR_BARANG melebihi stok layak jual ditolak tanpa mutasi
  const shortSwapRes = executeCustomerReturn(state, {
    customerName: 'Hotel Grand Serang',
    invoiceNo: 'INV-001',
    productId: 'PROD_01',
    productName: primalProd.name,
    weightGram: 50000,
    reason: 'Stok kurang',
    resolution: 'TUKAR_BARANG',
  });
  assert.equal(shortSwapRes.ok, false);
  assert.equal(shortSwapRes.errorCode, 'VALIDATION');
  assert.deepStrictEqual(shortSwapRes.state, state);
});

// ============================================================================
// 18. PHASE 2: PERSISTENSI TRANSAKSI SAAT RESTART & IDEMPOTENSI CHECKOUT
// ============================================================================
test('18. Transaksi bertahan setelah aplikasi restart dan idempotensi checkout menolak duplikat bahkan setelah >200 transaksi', () => {
  const store = new Map<string, string>();
  const prevWindow = (globalThis as any).window;
  (globalThis as any).window = {
    localStorage: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    },
  };

  try {
    const prod = makeProduct({ id: 'PROD_01', stockGram: 500000 });
    const lot = makeLot({ id: 'LOT_01', productId: 'PROD_01', expiryDate: '2026-12-20', weightGram: 500000 });
    const seed = {
      products: [prod],
      lots: [lot],
      customers: [makeCustomer({ id: 'CUST_01' })],
      receivables: [],
      inboundPOs: [],
      supplierInvoices: [],
      bazarPromos: [],
    };

    let state = loadEngineState(seed);
    const firstKey = 'IDEM-CHECKOUT-FIRST';
    const firstRes = commitSaleTransaction(state, {
      idempotencyKey: firstKey,
      customerId: 'CUST_01',
      paymentMethod: 'CASH',
      isFreeShipping: true,
      shippingFee: 0,
      cashTendered: 215000,
      items: [{ product: prod, weightGram: 1000, effectivePricePerKg: 215000 }],
      isOnline: false,
    });
    assert.equal(firstRes.ok, true);
    state = firstRes.state;

    // Retry cepat dengan key yang sama ditolak sebelum membuat transaksi ganda
    const retryRes = commitSaleTransaction(state, {
      idempotencyKey: firstKey,
      customerId: 'CUST_01',
      paymentMethod: 'CASH',
      isFreeShipping: true,
      shippingFee: 0,
      cashTendered: 215000,
      items: [{ product: prod, weightGram: 1000, effectivePricePerKg: 215000 }],
      isOnline: false,
    });
    assert.equal(retryRes.ok, false);
    assert.equal(retryRes.errorCode, 'DUPLICATE');
    assert.equal(retryRes.state.transactions.length, 1);

    // Tambah >200 transaksi berikutnya untuk membuktikan kunci awal tetap dicek dari daftar transaksi
    for (let i = 0; i < 205; i++) {
      const res = commitSaleTransaction(state, {
        idempotencyKey: `IDEM-BULK-${i}`,
        customerId: 'CUST_01',
        paymentMethod: 'TRANSFER',
        isFreeShipping: true,
        shippingFee: 0,
        cashTendered: 0,
        items: [{ product: prod, weightGram: 1000, effectivePricePerKg: 215000 }],
        isOnline: false,
      });
      assert.equal(res.ok, true);
      state = res.state;
    }

    // Restart aplikasi dari localStorage
    const restartedState = loadEngineState(seed);
    assert.equal(restartedState.transactions.length, 206);
    assert.equal(restartedState.lots.find((l) => l.id === 'LOT_01')?.weightGram, 500000 - 206000);
    assert.equal(restartedState.products[0].stockGram, 500000 - 206000);

    // Retry key transaksi pertama setelah >200 transaksi dan restart tetap ditolak
    const lateRetry = commitSaleTransaction(restartedState, {
      idempotencyKey: firstKey,
      customerId: 'CUST_01',
      paymentMethod: 'CASH',
      isFreeShipping: true,
      shippingFee: 0,
      cashTendered: 215000,
      items: [{ product: prod, weightGram: 1000, effectivePricePerKg: 215000 }],
      isOnline: false,
    });
    assert.equal(lateRetry.ok, false);
    assert.equal(lateRetry.errorCode, 'DUPLICATE');
    assert.equal(lateRetry.state.transactions.length, 206);
  } finally {
    (globalThis as any).window = prevWindow;
  }
});

// ============================================================================
// 19. PHASE 3: PEMULIHAN INDEXEDDB SAAT LOCALSTORAGE RUSAK & STORAGE FAILURE
// ============================================================================
test('19. localStorage rusak tidak menimpa IndexedDB yang sehat, dan kegagalan total penyimpanan memicu peringatan', async () => {
  const lsStore = new Map<string, string>();
  const idbStores = new Map<string, Map<string, any>>();
  const prevWindow = (globalThis as any).window;

  const mockIndexedDB = {
    open: () => {
      const req: any = {
        result: {
          objectStoreNames: { contains: (name: string) => idbStores.has(name) },
          createObjectStore: (name: string) => {
            if (!idbStores.has(name)) idbStores.set(name, new Map());
          },
          transaction: (storeName: string) => {
            if (!idbStores.has(storeName)) idbStores.set(storeName, new Map());
            const map = idbStores.get(storeName)!;
            const tx: any = {
              objectStore: () => ({
                get: (k: string) => {
                  const getReq: any = {};
                  queueMicrotask(() => {
                    getReq.result = map.get(k);
                    getReq.onsuccess?.();
                    tx.oncomplete?.();
                  });
                  return getReq;
                },
                put: (v: any, k: string) => {
                  const putReq: any = {};
                  queueMicrotask(() => {
                    map.set(k, structuredClone(v));
                    putReq.onsuccess?.();
                    tx.oncomplete?.();
                  });
                  return putReq;
                },
              }),
            };
            return tx;
          },
          close: () => {},
        },
      };
      queueMicrotask(() => {
        req.onupgradeneeded?.();
        req.onsuccess?.();
      });
      return req;
    },
  };

  (globalThis as any).window = {
    localStorage: {
      getItem: (k: string) => (lsStore.has(k) ? lsStore.get(k)! : null),
      setItem: (k: string, v: string) => lsStore.set(k, v),
      removeItem: (k: string) => lsStore.delete(k),
    },
    indexedDB: mockIndexedDB,
  };

  try {
    const prod = makeProduct({ id: 'PROD_01', stockGram: 30000 });
    const lot = makeLot({ id: 'LOT_01', productId: 'PROD_01', expiryDate: '2026-12-20', weightGram: 30000 });
    const seed = {
      products: [prod],
      lots: [lot],
      customers: [makeCustomer({ id: 'CUST_01' })],
      receivables: [],
      inboundPOs: [],
      supplierInvoices: [],
      bazarPromos: [],
    };

    const initial = createSeededEngineState(seed);
    const saleRes = commitSaleTransaction(initial, {
      idempotencyKey: 'SALE-IDB-RECOVERY',
      customerId: 'CUST_01',
      paymentMethod: 'CASH',
      isFreeShipping: true,
      shippingFee: 0,
      cashTendered: 430000,
      items: [{ product: prod, weightGram: 2000, effectivePricePerKg: 215000 }],
      isOnline: false,
    });
    assert.equal(saleRes.ok, true);
    // Tunggu antrean penulisan IndexedDB selesai
    await persistEngineState(saleRes.state).indexedDbPromise;

    // Simulasikan localStorage rusak/korup sebelum restart
    lsStore.set(ENGINE_STORAGE_KEY, '{corrupted-json-truncated...');
    const fallbackOnBoot = loadEngineState(seed);
    assert.equal(fallbackOnBoot.transactions.length, 0);

    // Hydrate harus memulihkan transaksi dari IndexedDB dan memperbaiki localStorage (bukan menimpa IDB!)
    const hydrated = await hydrateEngineStateFromIdb(fallbackOnBoot);
    assert.equal(hydrated.source, 'indexeddb');
    assert.equal(hydrated.state.transactions.length, 1);
    assert.equal(hydrated.state.lots[0].weightGram, 28000);
    const repairedLocal = JSON.parse(lsStore.get(ENGINE_STORAGE_KEY)!);
    assert.equal(repairedLocal.transactions.length, 1);

    // Simulasikan kegagalan total penyimpanan (QuotaExceededError pada localStorage + IDB gagal)
    const errors: string[] = [];
    const unsubscribe = subscribePersistenceErrors((msg) => errors.push(msg));
    (globalThis as any).window.localStorage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    const persistRes = persistEngineState(hydrated.state, {
      saveToIdb: async () => false,
    });
    assert.equal(persistRes.localStorageOk, false);
    const idbOk = await persistRes.indexedDbPromise;
    assert.equal(idbOk, false);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /cadangan/i);
    unsubscribe();
  } finally {
    (globalThis as any).window = prevWindow;
  }
});

// ============================================================================
// 20. PHASE 3: KATEGORI, SUPPLIER, & BACKUP/RESTORE LENGKAP + INTEGRITAS
// ============================================================================
test('20. Kategori, supplier, kontak supplier bertahan saat restart dan ikut tersimpan/dipulihkan di backup JSON', () => {
  const lsStore = new Map<string, string>();
  const prevWindow = (globalThis as any).window;
  (globalThis as any).window = {
    localStorage: {
      getItem: (k: string) => (lsStore.has(k) ? lsStore.get(k)! : null),
      setItem: (k: string, v: string) => lsStore.set(k, v),
      removeItem: (k: string) => lsStore.delete(k),
    },
  };

  try {
    const defaultCategories: ProductCategoryEntity[] = [
      { id: 'PRIMAL', label: 'Primal Cut', color: 'emerald', isCore: true },
    ];
    const defaultSuppliers = ['PT Meat Importers Indonesia'];
    const defaultPhones = { 'PT Meat Importers Indonesia': '0811-8822-3344' };
    const seed = {
      products: [makeProduct({ id: 'PROD_01', stockGram: 20000 })],
      lots: [makeLot({ id: 'LOT_01', productId: 'PROD_01', weightGram: 20000 })],
      customers: [makeCustomer({ id: 'CUST_01' })],
      receivables: [],
      inboundPOs: [],
      supplierInvoices: [],
      bazarPromos: [],
      categories: defaultCategories,
      suppliers: defaultSuppliers,
      supplierPhones: defaultPhones,
    };

    let state = loadEngineState(seed);

    // Tambah kategori custom & hapus ditolak untuk kategori core
    const addCatRes = addProductCategory(state, {
      id: 'WAGYU_A5',
      label: 'Wagyu Jepang A5',
      color: 'amber',
      isCore: false,
    });
    assert.equal(addCatRes.ok, true);
    state = addCatRes.state;

    const delCoreRes = deleteProductCategory(state, 'PRIMAL');
    assert.equal(delCoreRes.ok, false);

    // Tambah supplier baru & nomor kontak WhatsApp
    const addSupRes = addSupplierRecord(state, 'PT Nusantara Beef Jaya', '0812-0000-9999');
    assert.equal(addSupRes.ok, true);
    state = addSupRes.state;

    const updatePhoneRes = updateSupplierPhoneRecord(state, 'PT Nusantara Beef Jaya', '0812-1111-2222');
    assert.equal(updatePhoneRes.ok, true);
    state = updatePhoneRes.state;

    // Simulasikan restart dari localStorage
    const restarted = loadEngineState(seed);
    assert.equal(restarted.categories?.some((c) => c.id === 'WAGYU_A5'), true);
    assert.equal(restarted.suppliers?.includes('PT Nusantara Beef Jaya'), true);
    assert.equal(restarted.supplierPhones?.['PT Nusantara Beef Jaya'], '0812-1111-2222');

    // Ekspor backup -> bersihkan storage -> pulihkan backup
    const backup = exportEngineBackupJson(restarted);
    lsStore.clear();

    // Backup yang dimanipulasi harus ditolak oleh verifikasi integritas
    const tampered = backup.content.replace('PT Nusantara Beef Jaya', 'Supplier Palsu');
    const tamperedResult = parseAndValidateBackupJson(tampered);
    assert.equal(tamperedResult.ok, false);

    // Backup valid pulih utuh beserta kategori, supplier, dan nomor kontak
    const restoreResult = parseAndValidateBackupJson(backup.content);
    assert.equal(restoreResult.ok, true);
    if (restoreResult.ok) {
      assert.equal(restoreResult.state.categories?.some((c) => c.id === 'WAGYU_A5'), true);
      assert.equal(restoreResult.state.suppliers?.includes('PT Nusantara Beef Jaya'), true);
      assert.equal(restoreResult.state.supplierPhones?.['PT Nusantara Beef Jaya'], '0812-1111-2222');
    }

    // Legacy backup tanpa field categories/suppliers otomatis terisi dari fallbackDefaults
    const legacyStateObj = { ...restarted };
    delete legacyStateObj.categories;
    delete legacyStateObj.suppliers;
    delete legacyStateObj.supplierPhones;
    const legacyBackup = exportEngineBackupJson(legacyStateObj);
    const legacyRestore = parseAndValidateBackupJson(legacyBackup.content, {
      categories: defaultCategories,
      suppliers: defaultSuppliers,
      supplierPhones: defaultPhones,
    });
    assert.equal(legacyRestore.ok, true);
    if (legacyRestore.ok) {
      assert.equal(legacyRestore.state.categories?.length, 1);
      assert.deepStrictEqual(legacyRestore.state.suppliers, defaultSuppliers);
    }
  } finally {
    (globalThis as any).window = prevWindow;
  }
});

// ============================================================================
// 21. PHASE 3: INTEGRITAS ALUR LENGKAP (INBOUND -> TRIMMING -> PROMO -> VOID -> RETUR -> OPNAME -> PELUNASAN)
// ============================================================================
test('21. Alur lengkap toko menjaga keseimbangan jurnal, kesesuaian stok lot-produk-ledger, piutang, dan kuota promo', () => {
  const refNow = new Date(2026, 10, 13, 10, 0, 0);
  const shortplateProd = makeProduct({
    id: 'PROD_05',
    sku: 'SKU-SHORTPLATE-US',
    name: 'US Beef Shortplate 500g Slice',
    basePricePerKg: 125000,
    movingAvgHppPerKg: 95000,
    tierPrices: { RETAIL: 125000, HOREKA: 110000, VIP: 98000 },
    stockGram: 10000,
  });
  const ribeyeProd = makeProduct({
    id: 'PROD_01',
    sku: 'SKU-RIBEYE-AUS',
    name: 'Ribeye Meltique Australia (Primal)',
    basePricePerKg: 240000,
    movingAvgHppPerKg: 180000,
    tierPrices: { RETAIL: 240000, HOREKA: 215000, VIP: 195000 },
    stockGram: 30000,
  });
  const tetelanProd = makeProduct({
    id: 'PROD_03',
    sku: 'SKU-TETELAN-SP',
    name: 'Tetelan Rawon Super KARKASIA',
    basePricePerKg: 85000,
    movingAvgHppPerKg: 65000,
    tierPrices: { RETAIL: 85000, HOREKA: 75000, VIP: 68000 },
    stockGram: 5000,
  });

  const lots = [
    makeLot({ id: 'LOT_05', code: 'LOT-SLI-01', productId: 'PROD_05', product: shortplateProd.name, weightGram: 10000, hppKgRupiah: 95000, expiryDate: '2026-12-20' }),
    makeLot({ id: 'LOT_01', code: 'LOT-RIB-01', productId: 'PROD_01', product: ribeyeProd.name, weightGram: 30000, hppKgRupiah: 180000, expiryDate: '2026-12-20' }),
    makeLot({ id: 'LOT_03', code: 'LOT-TET-01', productId: 'PROD_03', product: tetelanProd.name, weightGram: 5000, hppKgRupiah: 65000, expiryDate: '2026-12-20' }),
  ];

  const cust = makeCustomer({
    id: 'CUST_01',
    name: 'Hotel Grand Serang',
    tier: 'HOREKA',
    creditLimit: 50000000,
    currentReceivable: 0,
  });

  const promo: BazarPromoEntity = {
    id: 'PROMO_RIB',
    sku: 'SKU-RIBEYE-AUS',
    promoPricePerKg: 190000,
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    quotaKg: 15,
    soldKg: 0,
    isActive: true,
    badgeLabel: 'Bazar Ribeye',
  };

  let state = createSeededEngineState({
    products: [shortplateProd, ribeyeProd, tetelanProd],
    lots,
    customers: [cust],
    receivables: [],
    inboundPOs: [
      {
        id: 'PO_NEW',
        poNumber: 'PO-2611-010',
        supplier: 'Australia Beef Direct Ltd',
        container: 'CONT-01',
        eta: 'Tiba',
        items: 'Ribeye Meltique Australia (Primal) (100 KG)',
        productCut: 'Ribeye Meltique Australia (Primal)',
        status: 'DALAM_PERJALANAN',
        totalRupiah: 18000000,
        orderWeightKg: 100,
      },
    ],
    supplierInvoices: [
      {
        id: 'SUP_INV_NEW',
        invoiceNumber: 'INV-SUP-010',
        poNumber: 'PO-2611-010',
        supplier: 'Australia Beef Direct Ltd',
        originCountry: 'Australia',
        totalAmountRupiah: 18000000,
        paidAmountRupiah: 0,
        remainingAmountRupiah: 18000000,
        dueDate: '2026-12-01',
        daysDiff: 18,
        status: 'BELUM_LUNAS',
      },
    ],
    bazarPromos: [promo],
  });

  // 1. Barang masuk PO untuk Ribeye Australia TIDAK boleh salah masuk ke US Beef Shortplate ("US" inside "Australia")
  const grRes = receiveInboundPurchase(state, 'PO_NEW', 100000, 0, 'Kepala Gudang', true);
  assert.equal(grRes.ok, true);
  state = grRes.state;
  assert.equal(state.products.find((p) => p.id === 'PROD_01')?.stockGram, 130000);
  assert.equal(state.products.find((p) => p.id === 'PROD_05')?.stockGram, 10000);

  // 2. Penjualan TEMPO dengan promo bazar 5 kg Ribeye (5 * 190.000 = 950.000)
  const tempoSale = commitSaleTransaction(state, {
    idempotencyKey: 'WORKFLOW-SALE-1',
    customerId: 'CUST_01',
    paymentMethod: 'TEMPO',
    isFreeShipping: true,
    shippingFee: 0,
    cashTendered: 0,
    items: [
      {
        product: state.products.find((p) => p.id === 'PROD_01')!,
        weightGram: 5000,
        effectivePricePerKg: 190000,
        appliedPromoId: 'PROMO_RIB',
      },
    ],
    now: refNow,
    isOnline: true,
  });
  assert.equal(tempoSale.ok, true);
  state = tempoSale.state;
  assert.equal(state.bazarPromos![0].soldKg, 5);
  assert.equal(state.customers[0].currentReceivable, 950000);
  assert.equal(state.receivables.length, 1);

  // 3. Pelunasan piutang lalu Batal Lunas pada tagihan aktif, serta penolakan Batal Lunas pada faktur void
  const recId = state.receivables[0].id;
  const cashBeforePay = state.cashInHandRupiah;
  const payRes = recordCustomerReceivablePayment(state, recId, 'Kasir Toko', true);
  assert.equal(payRes.ok, true);
  state = payRes.state;
  assert.equal(state.cashInHandRupiah, cashBeforePay + 950000);
  assert.equal(state.customers[0].currentReceivable, 0);

  const revertPayRes = revertCustomerReceivablePayment(state, recId, 'Kasir Toko');
  assert.equal(revertPayRes.ok, true);
  state = revertPayRes.state;
  assert.equal(state.cashInHandRupiah, cashBeforePay);
  assert.equal(state.customers[0].currentReceivable, 950000);

  // 4. Void transaksi TEMPO -> piutang 0, promo kembali ke 0, stok Ribeye kembali 130kg
  state = configureOwnerPinForTests(state);
  const voidRes = voidSaleTransaction(state, tempoSale.createdInvoice!.uuid, 'Salah order', 'Pemilik', true, undefined, { ownerPin: '654321' });
  assert.equal(voidRes.ok, true);
  state = voidRes.state;
  assert.equal(state.bazarPromos![0].soldKg, 0);
  assert.equal(state.customers[0].currentReceivable, 0);
  assert.equal(state.products.find((p) => p.id === 'PROD_01')?.stockGram, 130000);

  // Faktur yang sudah di-void TIDAK boleh dibuka kembali dengan revertCustomerReceivablePayment
  const blockedRevertVoid = revertCustomerReceivablePayment(state, recId, 'Kasir Toko');
  assert.equal(blockedRevertVoid.ok, false);
  assert.equal(blockedRevertVoid.errorCode, 'VALIDATION');

  // 5. Trimming 100% susut menghasilkan jurnal seimbang ke beban susut (bukan persediaan steak 0kg)
  const fullLossTrim = executeTrimmingConversion(state, {
    sourceLotId: 'LOT_01',
    inputGram: 2000,
    primaryGram: 0,
    secondaryGram: 0,
  });
  assert.equal(fullLossTrim.ok, true);
  state = fullLossTrim.state;
  assert.equal(state.journals[0].isBalanced, true);
  assert.equal(state.journals[0].lines.some((l) => l.accountCode === '5201' && l.debit > 0), true);

  // 6. Cek seluruh jurnal seimbang & total bobot stok produk == total lot non-karantina
  for (const j of state.journals) {
    assert.equal(j.isBalanced, true, `Jurnal tidak seimbang: ${j.referenceNo}`);
    assert.equal(j.totalDebit, j.totalCredit);
  }
  const prodRibStock = state.products.find((p) => p.id === 'PROD_01')!.stockGram;
  const lotRibStock = state.lots
    .filter((l) => !l.isQuarantined && l.productId === 'PROD_01')
    .reduce((acc, l) => acc + l.weightGram, 0);
  assert.equal(prodRibStock, lotRibStock);
});

// ============================================================================
// 22. PHASE 3: PENCEGAHAN TRANSAKSI BERULANG / IDEMPOTENSI DI SEMUA ALUR
// ============================================================================
test('22. Retry / klik berulang ditolak idempoten pada penerimaan PO, trimming, opname, retur, dan pembayaran', () => {
  const prod = makeProduct({ id: 'PROD_01', name: 'Ribeye Meltique Australia (Primal)', stockGram: 30000 });
  const lot = makeLot({ id: 'LOT_01', productId: 'PROD_01', product: prod.name, weightGram: 30000 });
  let state = createSeededEngineState({
    products: [prod],
    lots: [lot],
    customers: [makeCustomer({ id: 'CUST_01', currentReceivable: 500000 })],
    receivables: [
      {
        id: 'REC_01',
        customer: 'Hotel Grand Serang',
        customerId: 'CUST_01',
        tier: 'HOREKA',
        amount: 500000,
        limit: 25000000,
        dueDate: '2026-11-20',
        category: 'AKAN_DATANG',
        daysDiff: 7,
        invoice: 'INV-01',
        itemsSummary: 'Ribeye',
        phone: '0812',
        status: 'BELUM_LUNAS',
      },
    ],
    inboundPOs: [
      {
        id: 'PO_01',
        poNumber: 'PO-01',
        supplier: 'PT Meat',
        container: 'C1',
        eta: 'Tiba',
        items: 'Ribeye',
        status: 'DALAM_PERJALANAN',
        totalRupiah: 5000000,
      },
    ],
    supplierInvoices: [
      {
        id: 'SUP_01',
        invoiceNumber: 'INV-SUP-01',
        poNumber: 'PO-01',
        supplier: 'PT Meat',
        originCountry: 'Australia',
        totalAmountRupiah: 5000000,
        paidAmountRupiah: 0,
        remainingAmountRupiah: 5000000,
        dueDate: '2026-12-01',
        daysDiff: 18,
        status: 'BELUM_LUNAS',
      },
    ],
  });
  attachCompletedInvoice(state, 'INV-01', 'CUST_01', prod, 10000, 215000);

  // PO Inbound receive hanya bisa sekali
  const gr1 = receiveInboundPurchase(state, 'PO_01', 20000, 0);
  assert.equal(gr1.ok, true);
  state = gr1.state;
  const gr2 = receiveInboundPurchase(state, 'PO_01', 20000, 0);
  assert.equal(gr2.ok, false);
  assert.equal(gr2.errorCode, 'DUPLICATE');

  // Trimming dengan idempotencyKey sama ditolak
  const tr1 = executeTrimmingConversion(state, {
    idempotencyKey: 'TRIM-KEY-1',
    sourceLotId: 'LOT_01',
    inputGram: 5000,
    primaryGram: 4000,
    secondaryGram: 500,
  });
  assert.equal(tr1.ok, true);
  state = tr1.state;
  const tr2 = executeTrimmingConversion(state, {
    idempotencyKey: 'TRIM-KEY-1',
    sourceLotId: 'LOT_01',
    inputGram: 5000,
    primaryGram: 4000,
    secondaryGram: 500,
  });
  assert.equal(tr2.ok, false);
  assert.equal(tr2.errorCode, 'DUPLICATE');

  // Opname dengan idempotencyKey sama ditolak
  const op1 = executeStockOpname(state, {
    idempotencyKey: 'OPN-KEY-1',
    lotId: 'LOT_01',
    physicalWeightGram: 24500,
    reason: 'Cek rutin',
  });
  assert.equal(op1.ok, true);
  state = op1.state;
  const op2 = executeStockOpname(state, {
    idempotencyKey: 'OPN-KEY-1',
    lotId: 'LOT_01',
    physicalWeightGram: 24500,
    reason: 'Cek rutin',
  });
  assert.equal(op2.ok, false);
  assert.equal(op2.errorCode, 'DUPLICATE');

  // Retur dengan idempotencyKey sama ditolak
  const ret1 = executeCustomerReturn(state, {
    idempotencyKey: 'RET-KEY-1',
    customerName: 'Hotel Grand Serang',
    invoiceNo: 'INV-01',
    productId: 'PROD_01',
    productName: prod.name,
    weightGram: 1000,
    reason: 'Rusak',
    resolution: 'TUKAR_BARANG',
  });
  assert.equal(ret1.ok, true);
  state = ret1.state;
  const ret2 = executeCustomerReturn(state, {
    idempotencyKey: 'RET-KEY-1',
    customerName: 'Hotel Grand Serang',
    invoiceNo: 'INV-01',
    productId: 'PROD_01',
    productName: prod.name,
    weightGram: 1000,
    reason: 'Rusak',
    resolution: 'TUKAR_BARANG',
  });
  assert.equal(ret2.ok, false);
  assert.equal(ret2.errorCode, 'DUPLICATE');

  // Pembayaran piutang & utang supplier dengan idempotencyKey sama ditolak
  const recPay1 = recordCustomerReceivablePayment(state, 'REC_01', 'Kasir', true, 'PAY-REC-KEY-1');
  assert.equal(recPay1.ok, true);
  state = recPay1.state;
  const recPay2 = recordCustomerReceivablePayment(state, 'REC_01', 'Kasir', true, 'PAY-REC-KEY-1');
  assert.equal(recPay2.ok, false);
  assert.equal(recPay2.errorCode, 'DUPLICATE');

  const supPay1 = recordSupplierPayablePayment(state, 'SUP_01', 1000000, 'Admin', true, 'PAY-SUP-KEY-1');
  assert.equal(supPay1.ok, true);
  state = supPay1.state;
  const supPay2 = recordSupplierPayablePayment(state, 'SUP_01', 1000000, 'Admin', true, 'PAY-SUP-KEY-1');
  assert.equal(supPay2.ok, false);
  assert.equal(supPay2.errorCode, 'DUPLICATE');
});

// ============================================================================
// 23. PHASE 4: KEAMANAN PIN PEMILIK, UBAH PIN, ANTI-REPLAY APPROVAL, & PIN VOID
// ============================================================================
test('23. Keamanan PIN pemilik: verifikasi, ubah PIN, tolak replay approval, dan wajib PIN saat void', () => {
  const prod = makeProduct({ id: 'PROD_01', stockGram: 20000 });
  const lot = makeLot({ id: 'LOT_01', productId: 'PROD_01', product: prod.name, weightGram: 20000 });
  const cust = makeCustomer({ id: 'CUST_01', creditLimit: 1000000, currentReceivable: 0 });
  let state = createSeededEngineState({
    products: [prod],
    lots: [lot],
    customers: [cust],
    receivables: [],
    inboundPOs: [],
    supplierInvoices: [],
  });

  // Verifikasi & ubah PIN
  assert.equal(verifyOwnerPin(state, '123456'), true);
  assert.equal(verifyOwnerPin(state, '000000'), false);

  const badUpdateFormat = updateOwnerPin(state, '123456', 'abc');
  assert.equal(badUpdateFormat.ok, false);
  const badUpdateOldPin = updateOwnerPin(state, '999999', '654321');
  assert.equal(badUpdateOldPin.ok, false);

  const goodPinUpdate = updateOwnerPin(state, '123456', '654321', 'Owner');
  assert.equal(goodPinUpdate.ok, true);
  state = goodPinUpdate.state;
  assert.equal(verifyOwnerPin(state, '123456'), false);
  assert.equal(verifyOwnerPin(state, '654321'), true);

  // Approval request tidak bisa di-replay setelah RESOLVED
  const aprUuid = state.approvals[0].uuid;
  const wrongPinApr = resolveApprovalRequest(state, aprUuid, 'APPROVED', '123456', 'Owner');
  assert.equal(wrongPinApr.ok, false);
  const okApr = resolveApprovalRequest(state, aprUuid, 'APPROVED', '654321', 'Owner');
  assert.equal(okApr.ok, true);
  state = okApr.state;
  const replayApr = resolveApprovalRequest(state, aprUuid, 'REJECTED', '654321', 'Owner');
  assert.equal(replayApr.ok, false);
  assert.equal(replayApr.errorCode, 'VALIDATION');

  // Checkout lalu void dengan PIN salah ditolak, dengan PIN baru berhasil
  const sale = commitSaleTransaction(state, {
    idempotencyKey: 'P4-SALE-PIN-1',
    customerId: 'CUST_01',
    paymentMethod: 'CASH',
    isFreeShipping: true,
    shippingFee: 0,
    cashTendered: 430000,
    isOnline: true,
    items: [{ product: prod, weightGram: 2000, effectivePricePerKg: 215000 }],
  });
  assert.equal(sale.ok, true);
  state = sale.state;

  const wrongVoid = voidSaleTransaction(state, sale.createdInvoice!.uuid, 'Test', 'Owner', true, undefined, {
    ownerPin: '123456',
  });
  assert.equal(wrongVoid.ok, false);
  assert.equal(wrongVoid.state.transactions[0].status, 'COMPLETED');

  const okVoid = voidSaleTransaction(state, sale.createdInvoice!.uuid, 'Salah input', 'Owner', true, undefined, {
    ownerPin: '654321',
  });
  assert.equal(okVoid.ok, true);
  assert.equal(okVoid.state.transactions[0].status, 'VOIDED');
});

// ============================================================================
// 24. PHASE 4: TAMBAH PRODUK BARU DENGAN STOK AWAL -> LOT FEFO SIAP JUAL
// ============================================================================
test('24. Tambah produk baru dengan stok awal membuat lot FEFO nyata, ledger, jurnal seimbang, dan bisa langsung checkout', () => {
  let state = createSeededEngineState({
    products: [],
    lots: [],
    customers: [makeCustomer({ id: 'CUST_01' })],
    receivables: [],
    inboundPOs: [],
    supplierInvoices: [],
  });

  const addRes = addProductWithOpeningLot(
    state,
    {
      id: 'PROD_NEW_1',
      sku: 'SKU-PICANHA-BR',
      name: 'Picanha Brazil Top Sirloin Cap',
      category: 'PRIMAL',
      basePricePerKg: 260000,
      estimatedHppPerKg: 175000,
      stockGram: 15000,
      safetyStockGram: 5000,
    },
    'Admin Toko'
  );
  assert.equal(addRes.ok, true);
  state = addRes.state;

  const addedProd = state.products.find((p) => p.id === 'PROD_NEW_1')!;
  assert.equal(addedProd.stockGram, 15000);
  assert.equal(addedProd.movingAvgHppPerKg, 175000);
  assert.equal(state.lots.length, 1);
  assert.equal(state.lots[0].productId, 'PROD_NEW_1');
  assert.equal(state.lots[0].weightGram, 15000);
  assert.equal(state.journals.every((j) => j.isBalanced), true);

  // Duplikat SKU ditolak
  const dupRes = addProductWithOpeningLot(state, {
    id: 'PROD_NEW_2',
    sku: 'sku-picanha-br',
    name: 'Duplikat Picanha',
    category: 'PRIMAL',
    basePricePerKg: 260000,
    stockGram: 5000,
    safetyStockGram: 2000,
  });
  assert.equal(dupRes.ok, false);
  assert.equal(dupRes.errorCode, 'DUPLICATE');

  // Langsung checkout 3 KG produk baru -> FEFO lot terpotong menjadi 12 KG
  const sale = commitSaleTransaction(state, {
    idempotencyKey: 'P4-NEWPROD-SALE-1',
    customerId: 'CUST_01',
    paymentMethod: 'CASH',
    isFreeShipping: true,
    shippingFee: 0,
    cashTendered: 702000,
    isOnline: true,
    items: [{ product: addedProd, weightGram: 3000, effectivePricePerKg: 234000 }],
  });
  assert.equal(sale.ok, true);
  assert.equal(sale.state.products.find((p) => p.id === 'PROD_NEW_1')?.stockGram, 12000);
  assert.equal(sale.state.lots[0].weightGram, 12000);
});

// ============================================================================
// 25. PHASE 4: DAYSLEFT DINAMIS & KEUNIKAN NOMOR FAKTUR / LOT / REF
// ============================================================================
test('25. daysLeft lot dihitung dinamis dari expiryDate dan nomor faktur tetap unik walau daftar transaksi disaring/dipulihkan', () => {
  const future5 = new Date(Date.now() + 5 * 86400000);
  const y = future5.getFullYear();
  const m = String(future5.getMonth() + 1).padStart(2, '0');
  const d = String(future5.getDate()).padStart(2, '0');
  const futureYmd = `${y}-${m}-${d}`;
  assert.equal(computeDaysLeftFromExpiry(futureYmd), 5);

  const prod = makeProduct({ id: 'PROD_01', stockGram: 30000 });
  const lot = makeLot({
    id: 'LOT_01',
    productId: 'PROD_01',
    product: prod.name,
    weightGram: 30000,
    expiryDate: futureYmd,
    daysLeft: 99,
  });
  let state = createSeededEngineState({
    products: [prod],
    lots: [lot],
    customers: [makeCustomer({ id: 'CUST_01' })],
    receivables: [],
    inboundPOs: [],
    supplierInvoices: [],
  });

  state = normalizePersistedState(state);
  assert.equal(state.lots[0].daysLeft, 5);

  // Simulasikan transaksi lama hanya menyisakan faktur urutan tinggi INV-261113-0105
  const s1 = commitSaleTransaction(state, {
    idempotencyKey: 'P4-SEQ-1',
    customerId: 'CUST_01',
    paymentMethod: 'CASH',
    isFreeShipping: true,
    shippingFee: 0,
    cashTendered: 215000,
    isOnline: true,
    items: [{ product: prod, weightGram: 1000, effectivePricePerKg: 215000 }],
  });
  assert.equal(s1.ok, true);
  const inv1 = s1.createdInvoice!.invoiceNumber;
  const tamperedHistoryState: BusinessEngineState = {
    ...s1.state,
    transactions: [{ ...s1.createdInvoice!, invoiceNumber: 'INV-261113-0105' }],
  };
  const s2 = commitSaleTransaction(tamperedHistoryState, {
    idempotencyKey: 'P4-SEQ-2',
    customerId: 'CUST_01',
    paymentMethod: 'CASH',
    isFreeShipping: true,
    shippingFee: 0,
    cashTendered: 215000,
    isOnline: true,
    items: [{ product: prod, weightGram: 1000, effectivePricePerKg: 215000 }],
  });
  assert.equal(s2.ok, true);
  assert.notEqual(s2.createdInvoice!.invoiceNumber, inv1);
  assert.equal(s2.createdInvoice!.invoiceNumber.endsWith('-0106'), true);
});

// ============================================================================
// 26. PHASE 4: VALIDASI BACKUP KORUP, MODE PREVIEW TANPA OVERWRITE, & COMPATIBILITAS LAMA
// ============================================================================
test('26. Validasi backup menolak data korup/negatif, preview persist=false aman, dan backup lama tanpa field opsional tetap pulih', () => {
  const prod = makeProduct({ id: 'PROD_01', stockGram: 10000 });
  const lot = makeLot({ id: 'LOT_01', productId: 'PROD_01', product: prod.name, weightGram: 10000 });
  const state = createSeededEngineState({
    products: [prod],
    lots: [lot],
    customers: [makeCustomer({ id: 'CUST_01' })],
    receivables: [],
    inboundPOs: [],
    supplierInvoices: [],
  });

  // Preview { persist: false } tidak boleh menulis localStorage sebelum PIN pemilik disetujui
  const prevStorage = globalThis.window;
  const storeMap = new Map<string, string>();
  (globalThis as any).window = {
    localStorage: {
      getItem: (k: string) => storeMap.get(k) ?? null,
      setItem: (k: string, v: string) => storeMap.set(k, v),
      removeItem: (k: string) => storeMap.delete(k),
    },
  };
  try {
    const exported = exportEngineBackupJson(state);
    const previewRes = parseAndValidateBackupJson(exported.content, undefined, { persist: false });
    assert.equal(previewRes.ok, true);
    assert.equal(storeMap.has(ENGINE_STORAGE_KEY), false);

    // Backup dengan stok lot negatif ditolak
    const negativeLotBackup = JSON.stringify({
      ...state,
      lots: [{ ...lot, weightGram: -500 }],
    });
    const negRes = parseAndValidateBackupJson(negativeLotBackup);
    assert.equal(negRes.ok, false);

    // Backup dengan kas negatif ditolak
    const negativeCashBackup = JSON.stringify({
      ...state,
      cashInHandRupiah: -100,
    });
    const negCashRes = parseAndValidateBackupJson(negativeCashBackup);
    assert.equal(negCashRes.ok, false);

    // Backup legacy (pre-envelope tanpa bazarPromos, categories, suppliers, checksum) tetap kompatibel
    const legacyBackup = JSON.stringify({
      schemaVersion: 1,
      storeName: 'Toko Lama',
      deviceId: 'POS-OLD',
      ownerPin: '123456',
      cashInHandRupiah: 500000,
      pettyCashSpentTodayRupiah: 0,
      products: [prod],
      lots: [lot],
      customers: [makeCustomer({ id: 'CUST_01' })],
      receivables: [],
      inboundPOs: [],
      supplierInvoices: [],
      transactions: [],
      stockLedger: state.stockLedger,
      journals: state.journals,
      auditTrail: state.auditTrail,
      approvals: [],
      syncOutbox: [],
      processedIdempotencyKeys: [],
      lastUpdatedAt: new Date().toISOString(),
    });
    const legacyRes = parseAndValidateBackupJson(legacyBackup, {
      suppliers: ['PT Supplier Lama'],
    });
    assert.equal(legacyRes.ok, true);
    if (legacyRes.ok) {
      assert.deepEqual(legacyRes.state.suppliers, ['PT Supplier Lama']);
      assert.equal(legacyRes.state.products[0].stockGram, 10000);
    }
  } finally {
    (globalThis as any).window = prevStorage;
  }
});

// ============================================================================
// 27. PHASE 4: VALIDASI OPNAME, PENGECUALIAN KARANTINA DARI RINGKASAN, & TEMPO DP
// ============================================================================
test('27. Opname menolak alasan kosong, lot karantina tidak masuk ringkasan stok jual, dan tempo dengan DP konsisten saat void', () => {
  const prod = makeProduct({ id: 'PROD_01', stockGram: 20000, movingAvgHppPerKg: 180000 });
  const lot = makeLot({ id: 'LOT_01', productId: 'PROD_01', product: prod.name, weightGram: 20000, hppKgRupiah: 180000 });
  const cust = makeCustomer({ id: 'CUST_01', creditLimit: 10000000, currentReceivable: 1200000 });
  let state = createSeededEngineState({
    products: [prod],
    lots: [lot],
    customers: [cust],
    receivables: [{
      id: 'REC-OLD-1', customer: cust.name, customerId: cust.id, tier: cust.tier,
      amount: 1200000, limit: cust.creditLimit, dueDate: '2026-11-20',
      category: 'AKAN_DATANG', daysDiff: 7, invoice: 'INV-OLD-1',
      itemsSummary: prod.name, phone: cust.phone, status: 'BELUM_LUNAS',
    }],
    inboundPOs: [],
    supplierInvoices: [],
  });
  attachCompletedInvoice(state, 'INV-OLD-1', cust.id, prod, 5000, 240000);

  // Opname tanpa alasan ditolak
  const blankOpname = executeStockOpname(state, {
    lotId: 'LOT_01',
    physicalWeightGram: 19000,
    reason: '   ',
  });
  assert.equal(blankOpname.ok, false);
  assert.equal(blankOpname.errorCode, 'VALIDATION');

  // Retur barang masuk karantina tidak ikut dihitung totalInventoryWeightGram & totalInventoryValueRupiah
  const retRes = executeCustomerReturn(state, {
    customerName: cust.name,
    invoiceNo: 'INV-OLD-1',
    productId: 'PROD_01',
    productName: prod.name,
    weightGram: 4000,
    reason: 'Karton bocor',
    resolution: 'CREDIT_NOTE',
  });
  assert.equal(retRes.ok, true);
  state = retRes.state;
  const summary = selectOperationalSummary(state);
  assert.equal(summary.totalInventoryWeightGram, 20000);
  assert.equal(summary.totalInventoryValueRupiah, Math.round((20000 * 180000) / 1000));

  // Tempo 2 KG @ Rp 215.000 = Rp 430.000 dengan DP Rp 130.000 -> kas +130rb, piutang +300rb
  const cashBefore = state.cashInHandRupiah;
  const tempoDpSale = commitSaleTransaction(state, {
    idempotencyKey: 'P4-TEMPO-DP-1',
    customerId: 'CUST_01',
    paymentMethod: 'TEMPO',
    isFreeShipping: true,
    shippingFee: 0,
    cashTendered: 0,
    paidAmountRupiah: 130000,
    isOnline: true,
    items: [{ product: prod, weightGram: 2000, effectivePricePerKg: 215000 }],
  });
  assert.equal(tempoDpSale.ok, true);
  state = tempoDpSale.state;
  assert.equal(state.cashInHandRupiah, cashBefore + 130000);
  // Sisa piutang invoice lama Rp240rb tetap ada; DP mengurangi piutang invoice baru menjadi Rp300rb.
  assert.equal(state.customers[0].currentReceivable, 540000);
  assert.equal(state.receivables[0].amount, 300000);

  // Void transaksi Tempo+DP -> kas & piutang kembali tepat ke awal, jurnal seimbang
  state = configureOwnerPinForTests(state);
  const voidRes = voidSaleTransaction(state, tempoDpSale.createdInvoice!.uuid, 'Batal pesanan', 'Owner', true, undefined, {
    ownerPin: '654321',
  });
  assert.equal(voidRes.ok, true);
  assert.equal(voidRes.state.cashInHandRupiah, cashBefore);
  // Void hanya membalik transaksi baru; sisa piutang invoice lama tetap Rp240rb.
  assert.equal(voidRes.state.customers[0].currentReceivable, 240000);
  assert.equal(voidRes.state.journals.every((j) => j.isBalanced), true);
});

// ============================================================================
// 28. PHASE 4.1: REDACT PIN PEMILIK DI BACKUP JSON & PRESERVASI SAAT RESTORE
// ============================================================================
test('28. Backup JSON tidak mengekspos ownerPin plaintext dan tetap memulihkan PIN perangkat aktif dengan aman', () => {
  const prod = makeProduct({ id: 'PROD_01', stockGram: 15000 });
  const lot = makeLot({ id: 'LOT_01', productId: 'PROD_01', product: prod.name, weightGram: 15000 });
  let state = createSeededEngineState({
    products: [prod],
    lots: [lot],
    customers: [makeCustomer({ id: 'CUST_01' })],
    receivables: [],
    inboundPOs: [],
    supplierInvoices: [],
  });

  const pinRes = updateOwnerPin(state, '123456', '987654', 'Pemilik');
  assert.equal(pinRes.ok, true);
  state = pinRes.state;

  const exported = exportEngineBackupJson(state);
  assert.equal(exported.content.includes('987654'), false);
  assert.equal(exported.content.includes('"ownerPin"'), false);

  const parsedEnvelope = JSON.parse(exported.content);
  assert.equal(parsedEnvelope.ownerPinRedacted, true);
  assert.equal(parsedEnvelope.state.ownerPin, undefined);

  // Checksum menolak modifikasi file cadangan ter-redact
  const tampered = JSON.stringify({
    ...parsedEnvelope,
    state: { ...parsedEnvelope.state, cashInHandRupiah: 99999999 },
  });
  assert.equal(parseAndValidateBackupJson(tampered, { preserveOwnerPinHash: state.ownerPinHash, preserveOwnerPinSalt: state.ownerPinSalt, preserveOwnerPinNeedsChange: state.ownerPinNeedsChange }, { persist: false }).ok, false);

  // Restore valid mempertahankan PIN perangkat aktif
  const restored = parseAndValidateBackupJson(
    exported.content,
    { preserveOwnerPinHash: state.ownerPinHash, preserveOwnerPinSalt: state.ownerPinSalt },
    { persist: false }
  );
  assert.equal(restored.ok, true);
  if (restored.ok) {
    assert.equal(restored.state.ownerPin, undefined);
    assert.equal(restored.state.ownerPinHash, state.ownerPinHash);
    assert.equal(verifyOwnerPin(restored.state, '987654'), true);
    assert.equal(verifyOwnerPin(restored.state, '123456'), false);
  }
});

// ============================================================================
// 29. PHASE 4.1: BRUTE-FORCE COOLDOWN PIN & VALIDASI ALASAN VOID
// ============================================================================
test('29. Cooldown PIN mengunci setelah 5 percobaan salah dan void menolak alasan kosong/spasi', () => {
  resetPinAttemptGuard();
  const baseTime = 1_700_000_000_000;

  for (let i = 1; i <= 4; i++) {
    const res = recordPinAttemptOutcome(false, baseTime + i * 100);
    assert.equal(res.locked, false);
    assert.equal(res.failedAttempts, i);
  }

  const fifth = recordPinAttemptOutcome(false, baseTime + 500);
  assert.equal(fifth.locked, true);
  assert.equal(fifth.remainingSeconds, 30);

  const duringLock = checkPinAttemptGuard(baseTime + 10_500);
  assert.equal(duringLock.allowed, false);
  assert.equal(duringLock.remainingSeconds, 20);

  const afterCooldown = checkPinAttemptGuard(baseTime + 31_000);
  assert.equal(afterCooldown.allowed, true);
  assert.equal(afterCooldown.failedAttempts, 0);

  // Sukses verifikasi langsung mereset penghitung kegagalan
  recordPinAttemptOutcome(false, baseTime + 40_000);
  const resetAfterOk = recordPinAttemptOutcome(true, baseTime + 40_500);
  assert.equal(resetAfterOk.locked, false);
  assert.equal(resetAfterOk.failedAttempts, 0);

  // Void menolak alasan kosong / whitespace-only
  const prod = makeProduct({ id: 'PROD_01', stockGram: 10000 });
  const lot = makeLot({ id: 'LOT_01', productId: 'PROD_01', product: prod.name, weightGram: 10000 });
  const state = createSeededEngineState({
    products: [prod],
    lots: [lot],
    customers: [makeCustomer({ id: 'CUST_01' })],
    receivables: [],
    inboundPOs: [],
    supplierInvoices: [],
  });
  const sale = commitSaleTransaction(state, {
    idempotencyKey: 'P41-VOID-REASON-1',
    customerId: 'CUST_01',
    paymentMethod: 'CASH',
    isFreeShipping: true,
    shippingFee: 0,
    cashTendered: 215000,
    isOnline: true,
    items: [{ product: prod, weightGram: 1000, effectivePricePerKg: 215000 }],
  });
  assert.equal(sale.ok, true);

  const configuredSaleState = configureOwnerPinForTests(sale.state);
  const blankVoid = voidSaleTransaction(configuredSaleState, sale.createdInvoice!.uuid, '   ', 'Owner', true, undefined, {
    ownerPin: '654321',
  });
  assert.equal(blankVoid.ok, false);
  assert.equal(blankVoid.errorCode, 'VALIDATION');
  assert.equal(blankVoid.state.transactions[0].status, 'COMPLETED');
  resetPinAttemptGuard();
});

// ============================================================================
// 30. PHASE 4.1: KETAHANAN DATA SIKLUS PENUH (SIMPAN -> RESTART -> BACKUP -> RESTORE -> CHECKOUT)
// ============================================================================
test('30. Siklus ketahanan data penuh: checkout -> restart -> backup -> hapus -> restore -> transaksi baru tanpa duplikasi', async () => {
  const prevWindow = globalThis.window;
  const localMap = new Map<string, string>();
  (globalThis as any).window = {
    localStorage: {
      getItem: (k: string) => localMap.get(k) ?? null,
      setItem: (k: string, v: string) => localMap.set(k, v),
      removeItem: (k: string) => localMap.delete(k),
    },
  };

  try {
    const prod = makeProduct({ id: 'PROD_01', sku: 'SKU-RIBEYE-AUS', stockGram: 25000 });
    const lot = makeLot({ id: 'LOT_01', productId: 'PROD_01', product: prod.name, weightGram: 25000 });
    const todayYmd = new Date().toISOString().slice(0, 10);
    const nextMonthYmd = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const promo: BazarPromoEntity = {
      id: 'PRM_01',
      sku: prod.sku,
      promoPricePerKg: 175000,
      startDate: todayYmd,
      endDate: nextMonthYmd,
      quotaKg: 10,
      soldKg: 0,
      isActive: true,
      badgeLabel: 'Promo Uji 4.1',
    };
    const seedInput = {
      products: [prod],
      lots: [lot],
      customers: [makeCustomer({ id: 'CUST_01' })],
      receivables: [],
      inboundPOs: [],
      supplierInvoices: [],
      bazarPromos: [promo],
      categories: [{ id: 'PRIMAL', label: 'Potongan Utama', color: 'emerald', isCore: true }],
      suppliers: ['PT Meat Importers Indonesia'],
    };

    let state = createSeededEngineState(seedInput);
    const catRes = addProductCategory(state, { id: 'WAGYU', label: 'Wagyu Jepang', color: 'amber' });
    assert.equal(catRes.ok, true);
    state = catRes.state;
    const supRes = addSupplierRecord(state, 'PT Segar Nusantara', '628123456789');
    assert.equal(supRes.ok, true);
    state = supRes.state;

    // Transaksi 1 memakai promo 2 KG
    const sale1 = commitSaleTransaction(state, {
      idempotencyKey: 'P41-DUR-SALE-1',
      customerId: 'CUST_01',
      paymentMethod: 'CASH',
      isFreeShipping: true,
      shippingFee: 0,
      cashTendered: 350000,
      isOnline: true,
      items: [{ product: prod, weightGram: 2000, effectivePricePerKg: 175000, appliedPromoId: 'PRM_01' }],
    });
    assert.equal(sale1.ok, true);
    state = sale1.state;
    const inv1 = sale1.createdInvoice!.invoiceNumber;

    // Simulasikan restart aplikasi (baca ulang dari storage + hidrasi)
    const reloaded = loadEngineState(seedInput);
    const hydrated = await hydrateEngineStateFromIdb(reloaded, seedInput);
    assert.equal(hydrated.state.transactions.length, 1);
    assert.equal(hydrated.state.products[0].stockGram, 23000);
    assert.equal(hydrated.state.bazarPromos?.[0].soldKg, 2);
    assert.equal(hydrated.state.categories?.some((c) => c.id === 'WAGYU'), true);
    assert.equal(hydrated.state.suppliers?.includes('PT Segar Nusantara'), true);

    // Ekspor backup -> hapus storage -> pulihkan backup
    const backup = exportEngineBackupJson(hydrated.state);
    localMap.clear();
    const restored = parseAndValidateBackupJson(backup.content, { preserveOwnerPinHash: hydrated.state.ownerPinHash, preserveOwnerPinSalt: hydrated.state.ownerPinSalt, preserveOwnerPinNeedsChange: hydrated.state.ownerPinNeedsChange });
    assert.equal(restored.ok, true);
    if (!restored.ok) return;

    // Transaksi 2 setelah restore harus menghasilkan nomor faktur unik & saldo stok akurat
    const sale2 = commitSaleTransaction(restored.state, {
      idempotencyKey: 'P41-DUR-SALE-2',
      customerId: 'CUST_01',
      paymentMethod: 'TRANSFER',
      isFreeShipping: true,
      shippingFee: 0,
      cashTendered: 525000,
      isOnline: true,
      items: [{ product: restored.state.products[0], weightGram: 3000, effectivePricePerKg: 175000, appliedPromoId: 'PRM_01' }],
    });
    assert.equal(sale2.ok, true);
    assert.notEqual(sale2.createdInvoice!.invoiceNumber, inv1);
    assert.equal(sale2.state.transactions.length, 2);
    assert.equal(sale2.state.products[0].stockGram, 20000);
    assert.equal(sale2.state.journals.every((j) => j.isBalanced), true);
  } finally {
    (globalThis as any).window = prevWindow;
  }
});





test('31. Pembayaran piutang parsial memisahkan kas dan transfer serta dapat dibalik sesuai metode', () => {
  const prod = makeProduct({ id: 'PROD_PAY', stockGram: 10000 });
  const lot = makeLot({ id: 'LOT_PAY', productId: 'PROD_PAY', product: prod.name, weightGram: 10000 });
  const cust = makeCustomer({ id: 'CUST_PAY', currentReceivable: 500000 });
  const state = createSeededEngineState({
    products: [prod], lots: [lot], customers: [cust],
    receivables: [{
      id: 'REC_PAY', customer: cust.name, customerId: cust.id, tier: 'HOREKA',
      amount: 500000, limit: cust.creditLimit, dueDate: '2026-11-20',
      category: 'AKAN_DATANG', daysDiff: 7, invoice: 'INV-PAY',
      itemsSummary: 'Ribeye', phone: cust.phone, status: 'BELUM_LUNAS',
    }], inboundPOs: [], supplierInvoices: [],
  });
  const cashBefore = state.cashInHandRupiah;
  const transfer = recordCustomerReceivablePayment(state, 'REC_PAY', 'Admin', true, 'PAY-TRANSFER-1', 200000, 'TRANSFER');
  assert.equal(transfer.ok, true);
  assert.equal(transfer.state.receivables[0].amount, 300000);
  assert.equal(transfer.state.receivables[0].status, 'BELUM_LUNAS');
  assert.equal(transfer.state.cashInHandRupiah, cashBefore);
  assert.equal(transfer.state.bankBalanceRupiah, 200000);
  assert.equal(transfer.state.customers[0].currentReceivable, 300000);
  const cash = recordCustomerReceivablePayment(transfer.state, 'REC_PAY', 'Admin', true, 'PAY-CASH-2', 300000, 'CASH');
  assert.equal(cash.ok, true);
  assert.equal(cash.state.receivables[0].amount, 0);
  assert.equal(cash.state.receivables[0].status, 'LUNAS');
  assert.equal(cash.state.cashInHandRupiah, cashBefore + 300000);
  assert.equal(cash.state.bankBalanceRupiah, 200000);
  assert.equal(cash.state.journals.every((j) => j.isBalanced), true);
  const reverted = revertCustomerReceivablePayment(cash.state, 'REC_PAY', 'Owner');
  assert.equal(reverted.ok, true);
  assert.equal(reverted.state.receivables[0].amount, 500000);
  assert.equal(reverted.state.customers[0].currentReceivable, 500000);
  assert.equal(reverted.state.cashInHandRupiah, cashBefore);
  assert.equal(reverted.state.bankBalanceRupiah, 0);
});


test('32. Pull sync menerapkan event remote secara berurutan, idempoten, dan mencatat konflik stok', () => {
  const prod = makeProduct({ id: 'PROD_SYNC', stockGram: 5000 });
  const lot = makeLot({ id: 'LOT_SYNC', productId: prod.id, product: prod.name, weightGram: 5000 });
  const cust = makeCustomer({ id: 'CUST_SYNC', currentReceivable: 0 });
  const state = createSeededEngineState({
    products: [prod], lots: [lot], customers: [cust],
    receivables: [{ id: 'REC_SYNC', customer: cust.name, customerId: cust.id, tier: 'HOREKA', amount: 100000, limit: 1000000, dueDate: '2026-11-20', category: 'AKAN_DATANG', daysDiff: 7, invoice: 'INV-SYNC-REMOTE', itemsSummary: prod.name, phone: cust.phone, status: 'BELUM_LUNAS' }],
    inboundPOs: [], supplierInvoices: [],
  });
  const event = {
    serverSeq: 12, uuid: 'EV-SALE-REMOTE', idempotencyKey: 'REMOTE-SALE-1', entityType: 'SALE', createdAt: new Date().toISOString(),
    payload: {
      transactionUuid: 'TX-REMOTE-1', invoiceNumber: 'INV-REMOTE-1', customerId: cust.id, customerName: cust.name,
      paymentMethod: 'TEMPO', totalWeightGram: 2000, subtotalRupiah: 400000, grandTotalRupiah: 400000,
      paidAmountRupiah: 0, balanceDueRupiah: 400000, totalCogsRupiah: 300000,
      items: [{ productId: prod.id, productName: prod.name, weightGram: 2000, effectivePricePerKg: 200000, lineTotalRupiah: 400000, movingAvgHppPerKg: 150000 }],
      lotAllocations: [{ lotId: lot.id, lotCode: lot.code, productId: prod.id, productName: prod.name, weightGram: 2000, hppPerKg: 150000, cogsRupiah: 300000 }],
    },
  };
  const pulled = applyPulledSyncRecords(state, [event], 12);
  assert.equal(pulled.transactions.length, 1);
  assert.equal(pulled.lots.find((item) => item.id === lot.id)?.weightGram, 3000);
  assert.equal(pulled.customers[0].currentReceivable, 400000);
  assert.equal(pulled.receivables[0].id, 'REC_INV-REMOTE-1');
  assert.equal(pulled.receivables[0].amount, 400000);
  assert.equal(pulled.lastServerSeq, 12);
  const replay = applyPulledSyncRecords(pulled, [event], 12);
  assert.equal(replay.transactions.length, 1);
  assert.equal(replay.lots.find((item) => item.id === lot.id)?.weightGram, 3000);

  const shortage = applyPulledSyncRecords(state, [{ ...event, uuid: 'EV-SHORT', idempotencyKey: 'REMOTE-SALE-SHORT', serverSeq: 13, payload: { ...event.payload, transactionUuid: 'TX-SHORT', invoiceNumber: 'INV-SHORT', lotAllocations: [{ ...event.payload.lotAllocations[0], weightGram: 9000 }] } }], 13);
  assert.equal(shortage.remoteSyncConflicts?.length, 1);
  assert.equal(shortage.lots.find((item) => item.id === lot.id)?.weightGram, 0);
});


test('33. UI master data edits pass through engine validation, audit trail, and sync outbox without touching ledger balances', () => {
  const prod = makeProduct({ id: 'PROD_MASTER', stockGram: 5000, basePricePerKg: 100000 });
  const lot = makeLot({ id: 'LOT_MASTER', productId: prod.id, product: prod.name, weightGram: 5000 });
  const cust = makeCustomer({ id: 'CUST_MASTER', currentReceivable: 250000 });
  const state = createSeededEngineState({ products: [prod], lots: [lot], customers: [cust], receivables: [], inboundPOs: [], supplierInvoices: [] });
  const changedProducts = state.products.map((p) => p.id === prod.id ? { ...p, basePricePerKg: 125000 } : p);
  const changedLots = state.lots.map((l) => l.id === lot.id ? { ...l, loc: 'FREEZER-C-02' } : l);
  const changedCustomers = state.customers.map((c) => c.id === cust.id ? { ...c, creditLimit: 2000000, currentReceivable: 0 } : c);
  const result = updateMasterData(state, { products: changedProducts, lots: changedLots, customers: changedCustomers }, 'Update harga, lokasi, dan plafon pelanggan');
  assert.equal(result.ok, true);
  assert.equal(result.state.products[0].basePricePerKg, 125000);
  assert.equal(result.state.products[0].stockGram, 5000);
  assert.equal(result.state.lots[0].loc, 'FREEZER-C-02');
  assert.equal(result.state.lots[0].weightGram, 5000);
  assert.equal(result.state.customers[0].creditLimit, 2000000);
  assert.equal(result.state.customers[0].currentReceivable, 250000);
  assert.equal(result.state.syncOutbox[0].entityType, 'MASTER_DATA');
  assert.equal(result.state.auditTrail[0].action, 'UBAH_MASTER_DATA');
  const blocked = updateMasterData(state, { lots: state.lots.map((l) => ({ ...l, weightGram: l.weightGram - 1000 })) }, 'Mutasi stok ilegal');
  assert.equal(blocked.ok, false);
  assert.equal(blocked.state.lots[0].weightGram, 5000);
});


test('34. Business Engine menolak harga POS dari UI yang menyimpang dari tier/promo dan diskon tanpa PIN Owner', () => {
  const prod = makeProduct({ id: 'PROD_PRICE', sku: 'SKU-PRICE', name: 'Ribeye Test', stockGram: 10000, basePricePerKg: 240000, tierPrices: { RETAIL: 240000, HOREKA: 215000, VIP: 195000 } });
  const lot = makeLot({ id: 'LOT_PRICE', productId: prod.id, product: prod.name, weightGram: 10000 });
  const cust = makeCustomer({ id: 'CUST_PRICE', tier: 'HOREKA', currentReceivable: 0 });
  const base = createSeededEngineState({ products: [prod], lots: [lot], customers: [cust], receivables: [], inboundPOs: [], supplierInvoices: [] });
  const baseInput = {
    idempotencyKey: 'PRICE-TEST-1', customerId: cust.id, paymentMethod: 'CASH' as const,
    isFreeShipping: true, shippingFee: 0, cashTendered: 300000, isOnline: true,
    items: [{ product: prod, weightGram: 1000, effectivePricePerKg: 100000 }],
  };
  const undercut = commitSaleTransaction(base, baseInput);
  assert.equal(undercut.ok, false);
  assert.equal(undercut.errorCode, 'VALIDATION');

  const promo = { id: 'PROMO-PRICE', sku: prod.sku, promoPricePerKg: 190000, startDate: '2026-11-01', endDate: '2026-11-30', quotaKg: 10, soldKg: 0, isActive: true, badgeLabel: 'Promo Test' };
  const withPromo = createSeededEngineState({ products: [prod], lots: [lot], customers: [cust], receivables: [], inboundPOs: [], supplierInvoices: [], bazarPromos: [promo] });
  const ignoredPromo = commitSaleTransaction(withPromo, { ...baseInput, idempotencyKey: 'PRICE-TEST-2', items: [{ product: prod, weightGram: 1000, effectivePricePerKg: 215000 }] });
  assert.equal(ignoredPromo.ok, false);
  assert.equal(ignoredPromo.errorCode, 'VALIDATION');

  const unauthorizedDiscount = commitSaleTransaction(base, {
    ...baseInput, idempotencyKey: 'PRICE-TEST-3', discountRupiah: 1000,
    items: [{ product: prod, weightGram: 1000, effectivePricePerKg: 215000 }],
  });
  assert.equal(unauthorizedDiscount.ok, false);
  assert.equal(unauthorizedDiscount.errorCode, 'VALIDATION');
});


test('35. Identitas perangkat memisahkan nomor faktur antar HP dan tidak ikut berpindah lewat backup', () => {
  const prod = makeProduct({ id: 'PROD_DEVICE', sku: 'SKU-DEVICE', stockGram: 10000, basePricePerKg: 240000, tierPrices: { RETAIL: 240000, HOREKA: 215000, VIP: 195000 } });
  const lotA = makeLot({ id: 'LOT_DEVICE_A', productId: prod.id, product: prod.name, weightGram: 10000 });
  const lotB = makeLot({ id: 'LOT_DEVICE_B', productId: prod.id, product: prod.name, weightGram: 10000 });
  const cust = makeCustomer({ id: 'CUST_DEVICE', tier: 'RETAIL' });
  const common = { products: [prod], customers: [cust], receivables: [], inboundPOs: [], supplierInvoices: [] };
  const stateA = createSeededEngineState({ ...common, lots: [lotA], deviceId: 'DEVICE-ALPHA01' });
  const stateB = createSeededEngineState({ ...common, lots: [lotB], deviceId: 'DEVICE-BRAVO02' });
  const input = (idempotencyKey: string) => ({
    idempotencyKey, customerId: cust.id, paymentMethod: 'CASH' as const, isFreeShipping: true,
    shippingFee: 0, cashTendered: 240000, isOnline: true,
    now: new Date(2026, 10, 13, 10, 0, 0),
    items: [{ product: prod, weightGram: 1000, effectivePricePerKg: 240000 }],
  });
  const saleA = commitSaleTransaction(stateA, input('DEVICE-A-SALE'));
  const saleB = commitSaleTransaction(stateB, input('DEVICE-B-SALE'));
  assert.equal(saleA.ok, true);
  assert.equal(saleB.ok, true);
  assert.notEqual(saleA.createdInvoice?.invoiceNumber, saleB.createdInvoice?.invoiceNumber);
  assert.match(saleA.createdInvoice!.invoiceNumber, /^INV-ICEALPHA01-261113-/);
  const backup = exportEngineBackupJson(stateA);
  const envelope = JSON.parse(backup.content);
  assert.equal(envelope.state.deviceId, undefined);
  const restored = parseAndValidateBackupJson(backup.content, { preserveDeviceId: 'DEVICE-RESTORE01' }, { persist: false });
  assert.equal(restored.ok, true);
  if (restored.ok) assert.equal(restored.state.deviceId, 'DEVICE-RESTORE01');
});


test('36. Retur menolak faktur/pelanggan yang tidak cocok dan kuantitas melebihi sisa barang faktur', () => {
  const prod = makeProduct({ id: 'PROD_RETURN', stockGram: 5000 });
  const lot = makeLot({ id: 'LOT_RETURN', productId: prod.id, product: prod.name, weightGram: 5000 });
  const cust = makeCustomer({ id: 'CUST_RETURN', name: 'Hotel Retur' });
  const state = createSeededEngineState({ products: [prod], lots: [lot], customers: [cust], receivables: [], inboundPOs: [], supplierInvoices: [] });
  attachCompletedInvoice(state, 'INV-RETURN-TEST', cust.id, prod, 1000, 240000);
  const wrongCustomer = executeCustomerReturn(state, { customerName: 'Pelanggan Lain', invoiceNo: 'INV-RETURN-TEST', productId: prod.id, productName: prod.name, weightGram: 500, reason: 'Keliru', resolution: 'CREDIT_NOTE' });
  assert.equal(wrongCustomer.ok, false);
  assert.equal(wrongCustomer.errorCode, 'VALIDATION');
  const wrongInvoice = executeCustomerReturn(state, { customerName: cust.name, invoiceNo: 'INV-NOT-FOUND', productId: prod.id, productName: prod.name, weightGram: 500, reason: 'Keliru', resolution: 'CREDIT_NOTE' });
  assert.equal(wrongInvoice.ok, false);
  assert.equal(wrongInvoice.errorCode, 'NOT_FOUND');
  const tooMuch = executeCustomerReturn(state, { customerName: cust.name, invoiceNo: 'INV-RETURN-TEST', productId: prod.id, productName: prod.name, weightGram: 1001, reason: 'Lebih dari faktur', resolution: 'CREDIT_NOTE' });
  assert.equal(tooMuch.ok, false);
  assert.equal(tooMuch.errorCode, 'VALIDATION');
});


test('37. Migrasi PIN lama menghash plaintext, memberi salt, dan memaksa penggantian PIN bawaan', () => {
  const seeded = createSeededEngineState({ products: [], lots: [], customers: [], receivables: [], inboundPOs: [], supplierInvoices: [] });
  const legacy = { ...seeded, ownerPin: '654321', ownerPinHash: undefined, ownerPinSalt: undefined, ownerPinNeedsChange: undefined } as any;
  const migrated = normalizePersistedState(legacy);
  assert.equal(migrated.ownerPin, undefined);
  assert.equal(migrated.ownerPinNeedsChange, true);
  assert.ok(migrated.ownerPinHash && migrated.ownerPinHash !== '654321');
  assert.ok(migrated.ownerPinSalt);
  assert.equal(verifyOwnerPin(migrated, '654321'), true);
  assert.equal(JSON.stringify(migrated).includes('"ownerPin":"654321"'), false);
  const changed = updateOwnerPin(migrated, '654321', '987654', 'Owner');
  assert.equal(changed.ok, true);
  assert.equal(changed.state.ownerPinNeedsChange, false);
  assert.equal(verifyOwnerPin(changed.state, '987654'), true);
  assert.equal(verifyOwnerPin(changed.state, '654321'), false);
});


test('38. Pull sync merekonsiliasi pembayaran piutang dan utang supplier per metode/nominal', () => {
  const cust = makeCustomer({ id: 'CUST_PULL_PAY', currentReceivable: 100000 });
  const state = createSeededEngineState({
    products: [], lots: [], customers: [cust],
    receivables: [{ id: 'REC_PULL_PAY', customer: cust.name, customerId: cust.id, tier: 'HOREKA', amount: 100000, limit: 1000000, dueDate: '2026-11-20', category: 'AKAN_DATANG', daysDiff: 7, invoice: 'INV-PULL-PAY', itemsSummary: 'Ribeye', phone: cust.phone, status: 'BELUM_LUNAS' }],
    inboundPOs: [],
    supplierInvoices: [{ id: 'SUP_PULL', invoiceNumber: 'SUP-INV-PULL', poNumber: 'PO-PULL', supplier: 'Supplier Test', originCountry: 'Australia', totalAmountRupiah: 200000, paidAmountRupiah: 0, remainingAmountRupiah: 200000, dueDate: '2026-12-01', daysDiff: 18, status: 'BELUM_LUNAS' }],
  });
  const pulled = applyPulledSyncRecords(state, [
    { serverSeq: 21, uuid: 'EV-REC-PAY', idempotencyKey: 'REC-PAY-REMOTE', entityType: 'PAYMENT', createdAt: new Date().toISOString(), payload: { kind: 'RECEIVABLE_PAYMENT', recId: 'REC_PULL_PAY', amountRupiah: 40000, paymentMethod: 'TRANSFER' } },
    { serverSeq: 22, uuid: 'EV-SUP-PAY', idempotencyKey: 'SUP-PAY-REMOTE', entityType: 'PAYMENT', createdAt: new Date().toISOString(), payload: { kind: 'SUPPLIER_PAYMENT', invoiceId: 'SUP_PULL', amountPaidRupiah: 50000 } },
  ], 22);
  assert.equal(pulled.receivables[0].amount, 60000);
  assert.equal(pulled.receivables[0].status, 'BELUM_LUNAS');
  assert.equal(pulled.customers[0].currentReceivable, 60000);
  assert.equal(pulled.bankBalanceRupiah, -10000);
  assert.equal(pulled.receivablePayments?.[0].paymentMethod, 'TRANSFER');
  assert.equal(pulled.supplierInvoices[0].paidAmountRupiah, 50000);
  assert.equal(pulled.supplierInvoices[0].remainingAmountRupiah, 150000);
});



test('33. Retur wajib cocok faktur dan akumulasi retur tidak boleh melebihi berat produk terjual', () => {
  const prod = makeProduct({ id: 'PROD_RET', name: 'Tenderloin Test', stockGram: 10000 });
  const lot = makeLot({ id: 'LOT_RET', productId: prod.id, product: prod.name, weightGram: 10000 });
  const customer = makeCustomer({ id: 'CUST_01', currentReceivable: 2000000 });
  const state = createSeededEngineState({
    products: [prod], lots: [lot], customers: [customer],
    receivables: [{
      id: 'REC-RET-01', customer: customer.name, customerId: customer.id, tier: customer.tier,
      amount: 2000000, limit: customer.creditLimit, dueDate: '2026-11-20',
      category: 'AKAN_DATANG', daysDiff: 7, invoice: 'INV-RET-01',
      itemsSummary: prod.name, phone: customer.phone, status: 'BELUM_LUNAS',
    }],
    inboundPOs: [], supplierInvoices: [],
  });
  attachCompletedInvoice(state, 'INV-RET-01', customer.id, prod, 10000, 200000);

  const wrongInvoice = executeCustomerReturn(state, {
    customerName: customer.name, invoiceNo: 'INV-OTHER', productId: prod.id,
    productName: prod.name, weightGram: 1000, reason: 'Rusak', resolution: 'CREDIT_NOTE',
  });
  assert.equal(wrongInvoice.ok, false);
  assert.deepStrictEqual(wrongInvoice.state, state);

  const first = executeCustomerReturn(state, {
    idempotencyKey: 'RET-PART-1', customerName: customer.name, invoiceNo: 'INV-RET-01',
    productId: prod.id, productName: prod.name, weightGram: 6000,
    reason: 'Kemasan rusak', resolution: 'CREDIT_NOTE', evidenceMediaId: 'media-retur-test-001',
  });
  assert.equal(first.ok, true);
  assert.equal(first.state.customerReturns?.[0].weightGram, 6000);
  assert.equal(first.state.customerReturns?.[0].evidenceMediaId, 'media-retur-test-001');
  assert.equal(first.state.syncOutbox[0].payload?.evidenceMediaId, 'media-retur-test-001');

  const overReturn = executeCustomerReturn(first.state, {
    idempotencyKey: 'RET-OVER', customerName: customer.name, invoiceNo: 'INV-RET-01',
    productId: prod.id, productName: prod.name, weightGram: 5000,
    reason: 'Kurang sesuai', resolution: 'CREDIT_NOTE',
  });
  assert.equal(overReturn.ok, false);
  assert.equal(overReturn.errorCode, 'VALIDATION');
  assert.deepStrictEqual(overReturn.state, first.state);

  const remaining = executeCustomerReturn(first.state, {
    idempotencyKey: 'RET-PART-2', customerName: customer.name, invoiceNo: 'INV-RET-01',
    productId: prod.id, productName: prod.name, weightGram: 4000,
    reason: 'Sisa retur', resolution: 'CREDIT_NOTE',
  });
  assert.equal(remaining.ok, true);
  assert.equal(remaining.state.customerReturns?.filter(r => r.invoiceNo === 'INV-RET-01').reduce((sum, r) => sum + r.weightGram, 0), 10000);
});

test('Credit note dan refund kas ditolak jika saldo sumber dana tidak mencukupi', () => {
  const prod = makeProduct({ id: 'PROD_RET_BAL', stockGram: 5000 });
  const lot = makeLot({ id: 'LOT_RET_BAL', productId: prod.id, product: prod.name, weightGram: 5000 });
  const customer = makeCustomer({ id: 'CUST_RET_BAL', currentReceivable: 0 });
  const state = createSeededEngineState({
    products: [prod], lots: [lot], customers: [customer],
    receivables: [], inboundPOs: [], supplierInvoices: [],
  });
  attachCompletedInvoice(state, 'INV-RET-PAID', customer.id, prod, 1000, 200000);

  const unsupportedCredit = executeCustomerReturn(state, {
    customerName: customer.name, invoiceNo: 'INV-RET-PAID', productId: prod.id,
    productName: prod.name, weightGram: 500, reason: 'Rusak', resolution: 'CREDIT_NOTE',
  });
  assert.equal(unsupportedCredit.ok, false);
  assert.equal(unsupportedCredit.errorCode, 'VALIDATION');
  assert.deepStrictEqual(unsupportedCredit.state, state);

  const noCashRefundState = { ...state, cashInHandRupiah: 0 };
  const noCashRefund = executeCustomerReturn(noCashRefundState, {
    customerName: customer.name, invoiceNo: 'INV-RET-PAID', productId: prod.id,
    productName: prod.name, weightGram: 500, reason: 'Rusak', resolution: 'REFUND_KAS',
  });
  assert.equal(noCashRefund.ok, false);
  assert.equal(noCashRefund.errorCode, 'VALIDATION');
  assert.deepStrictEqual(noCashRefund.state, noCashRefundState);

  const partialReceivableState: BusinessEngineState = {
    ...state,
    customers: [{ ...customer, currentReceivable: 200000 }],
    receivables: [{
      id: 'REC-RET-PAID', customer: customer.name, customerId: customer.id, tier: customer.tier,
      amount: 50000, limit: customer.creditLimit, dueDate: '2026-11-20',
      category: 'AKAN_DATANG', daysDiff: 7, invoice: 'INV-RET-PAID',
      itemsSummary: prod.name, phone: customer.phone, status: 'BELUM_LUNAS',
    }],
  };
  const insufficientInvoiceCredit = executeCustomerReturn(partialReceivableState, {
    customerName: customer.name, invoiceNo: 'INV-RET-PAID', productId: prod.id,
    productName: prod.name, weightGram: 500, reason: 'Rusak', resolution: 'CREDIT_NOTE',
  });
  assert.equal(insufficientInvoiceCredit.ok, false);
  assert.deepStrictEqual(insufficientInvoiceCredit.state, partialReceivableState);

  const fundedCashState = { ...state, cashInHandRupiah: 200000 };
  const validCashRefund = executeCustomerReturn(fundedCashState, {
    customerName: customer.name, invoiceNo: 'INV-RET-PAID', productId: prod.id,
    productName: prod.name, weightGram: 500, reason: 'Rusak', resolution: 'REFUND_KAS',
  });
  assert.equal(validCashRefund.ok, true);
  assert.equal(validCashRefund.state.cashInHandRupiah, 100000);
  assert.equal(validCashRefund.state.journals[0].isBalanced, true);
});

test('34. Pembayaran piutang parsial memisahkan kas dan transfer serta reversal mengembalikan saldo masing-masing', () => {
  const customer = makeCustomer({ id: 'CUST_PAY', currentReceivable: 1000000 });
  const state = createSeededEngineState({
    products: [], lots: [], customers: [customer],
    receivables: [{
      id: 'REC_PAY', customer: customer.name, customerId: customer.id, tier: 'HOREKA',
      amount: 1000000, limit: 5000000, dueDate: '2026-11-20', category: 'AKAN_DATANG',
      daysDiff: 7, invoice: 'INV-PAY-01', itemsSummary: 'Daging', phone: customer.phone,
      status: 'BELUM_LUNAS',
    }],
    inboundPOs: [], supplierInvoices: [],
  });
  const cashBefore = state.cashInHandRupiah;
  const bankBefore = state.bankBalanceRupiah ?? 0;

  const cashPart = recordCustomerReceivablePayment(state, 'REC_PAY', 'Admin', true, 'PAY-CASH-1', 300000, 'CASH');
  assert.equal(cashPart.ok, true);
  assert.equal(cashPart.state.receivables[0].amount, 700000);
  assert.equal(cashPart.state.cashInHandRupiah, cashBefore + 300000);
  assert.equal(cashPart.state.bankBalanceRupiah ?? 0, bankBefore);

  const transferPart = recordCustomerReceivablePayment(cashPart.state, 'REC_PAY', 'Admin', true, 'PAY-TRF-1', 200000, 'TRANSFER');
  assert.equal(transferPart.ok, true);
  assert.equal(transferPart.state.receivables[0].amount, 500000);
  assert.equal(transferPart.state.cashInHandRupiah, cashBefore + 300000);
  assert.equal(transferPart.state.bankBalanceRupiah ?? 0, bankBefore + 200000);
  assert.equal(transferPart.state.receivablePayments?.length, 2);

  const invalidOverpay = recordCustomerReceivablePayment(transferPart.state, 'REC_PAY', 'Admin', true, 'PAY-OVER', 500001, 'TRANSFER');
  assert.equal(invalidOverpay.ok, false);
  assert.deepStrictEqual(invalidOverpay.state, transferPart.state);

  const reversed = revertCustomerReceivablePayment(transferPart.state, 'REC_PAY', 'Admin');
  assert.equal(reversed.ok, true);
  assert.equal(reversed.state.receivables[0].amount, 1000000);
  assert.equal(reversed.state.cashInHandRupiah, cashBefore);
  assert.equal(reversed.state.bankBalanceRupiah ?? 0, bankBefore);
  assert.equal(reversed.state.customers[0].currentReceivable, 1000000);
  assert.equal(reversed.state.receivablePayments?.every(p => !!p.reversedAt), true);
});

