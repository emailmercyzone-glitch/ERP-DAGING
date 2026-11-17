type RecordValue = Record<string, unknown>;

export interface SalesInvoiceOwnership {
  salesId: string;
  customerId: string;
  receivableId?: string;
  receivableRemaining?: number;
  voided?: boolean;
  allocations: Array<{ lotId: string; lotCode: string; productId: string; productName: string; weightGram: number }>;
  soldProducts: Array<{ productId: string; weightGram: number; lineTotalRupiah: number }>;
  returnedByProduct: Map<string, number>;
}

export interface SalesMediaOwnership {
  salesId: string;
  invoiceNo: string;
}

export interface SalesAcceptedEvent {
  uuid: string;
  salesId: string;
  entityType: string;
  payloadFingerprint: string;
}

export interface SalesOwnershipIndex {
  customerSales: Map<string, string>;
  salesCustomerHistory: Map<string, Set<string>>;
  umumCustomerIds: Set<string>;
  invoices: Map<string, SalesInvoiceOwnership>;
  media: Map<string, SalesMediaOwnership>;
  acceptedEvents: Map<string, SalesAcceptedEvent>;
}

export function cloneSalesOwnershipIndex(index: SalesOwnershipIndex): SalesOwnershipIndex {
  return {
    customerSales: new Map(index.customerSales),
    salesCustomerHistory: new Map([...index.salesCustomerHistory].map(([key, value]) => [key, new Set(value)])),
    umumCustomerIds: new Set(index.umumCustomerIds),
    invoices: new Map([...index.invoices].map(([key, value]) => [key, {
      ...value,
      allocations: value.allocations.map((allocation) => ({ ...allocation })),
      soldProducts: value.soldProducts.map((item) => ({ ...item })),
      returnedByProduct: new Map(value.returnedByProduct),
    }])) ,
    media: new Map([...index.media].map(([key, value]) => [key, { ...value }])),
    acceptedEvents: new Map([...index.acceptedEvents].map(([key, value]) => [key, { ...value }])),
  };
}

const COST_FIELDS = new Set([
  'movingAvgHppPerKg', 'hppKgRupiah', 'hppPerKg', 'cogsRupiah', 'totalCogsRupiah',
  'grossProfitRupiah', 'unitCostPerKg', 'valueRupiahDelta', 'movingAvgHppAfterKg',
  'totalLandedCost', 'openingValue', 'totalRawCost', 'primaryNetCost',
  'tetelanValue', 'effectiveSteakHpp', 'secondaryHpp',
]);

const PRODUCT_FIELDS = [
  'id', 'sku', 'name', 'basePricePerKg', 'tierPrices', 'category',
  'stockGram', 'safetyStockGram', 'tag', 'alternativeId', 'alternativeName', 'alternativeReason',
] as const;
const LOT_FIELDS = [
  'id', 'code', 'product', 'productId', 'daysLeft', 'expiryDate',
  'weightGram', 'maxCapacityGram', 'loc', 'isFefo', 'isQuarantined',
] as const;
const CUSTOMER_FIELDS = [
  'id', 'code', 'name', 'tier', 'creditLimit', 'currentReceivable',
  'termDays', 'phone', 'address', 'assignedSalesId',
] as const;
const CATEGORY_FIELDS = ['id', 'label', 'description', 'color', 'isCore', 'deletedAt'] as const;
const PROMO_FIELDS = ['id', 'sku', 'promoPricePerKg', 'startDate', 'endDate', 'quotaKg', 'soldKg', 'isActive', 'badgeLabel', 'title', 'productName', 'normalPricePerKg', 'discountRupiahPerKg', 'discountPercent'] as const;

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'undefined';
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const record = value as Record<string, unknown>;
  return '{' + Object.keys(record).sort().map((key) =>
    JSON.stringify(key) + ':' + stableStringify(record[key])
  ).join(',') + '}';
}

function rememberAcceptedSalesEvent(
  event: RecordValue,
  payload: RecordValue,
  salesId: string,
  entityType: string,
  index: SalesOwnershipIndex
): void {
  const uuid = text(event.uuid);
  const idempotencyKey = text(event.idempotencyKey ?? event.idempotency_key);
  if (!uuid || !idempotencyKey) return;
  index.acceptedEvents.set(idempotencyKey, {
    uuid,
    salesId,
    entityType,
    payloadFingerprint: stableStringify(payload),
  });
}

function pickFields(value: unknown, fields: readonly string[]): RecordValue | null {
  if (!isRecord(value)) return null;
  const picked: RecordValue = {};
  for (const field of fields) {
    const item = value[field];
    if (item !== undefined) picked[field] = item;
  }
  return picked;
}

function redactCosts(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactCosts);
  if (!isRecord(value)) return value;
  const safe: RecordValue = {};
  for (const [key, nested] of Object.entries(value)) {
    if (!COST_FIELDS.has(key)) safe[key] = redactCosts(nested);
  }
  return safe;
}

function isUmumCustomer(customer: RecordValue): boolean {
  const id = text(customer.id).toLocaleUpperCase('id-ID');
  const code = text(customer.code).toLocaleUpperCase('id-ID');
  const name = text(customer.name).toLocaleUpperCase('id-ID');
  return id === 'CUST_UMUM' || code === 'UMUM' || name === 'UMUM';
}

function eventPayload(event: RecordValue): RecordValue {
  return isRecord(event.payload) ? event.payload : {};
}

export function buildSalesOwnershipIndex(records: Array<Record<string, unknown>>): SalesOwnershipIndex {
  const index: SalesOwnershipIndex = {
    customerSales: new Map(),
    salesCustomerHistory: new Map(),
    umumCustomerIds: new Set(),
    invoices: new Map(),
    media: new Map(),
    acceptedEvents: new Map(),
  };
  const ordered = [...records].sort((a, b) =>
    Number(a.serverSeq ?? a.server_seq ?? 0) - Number(b.serverSeq ?? b.server_seq ?? 0)
  );

  for (const raw of ordered) {
    const event = raw as RecordValue;
    const type = text(event.entityType ?? event.entity_type).toUpperCase();
    const payload = eventPayload(event);
    const eventSalesId = text(payload.salesId);
    if (eventSalesId && ['SALE', 'RETURN', 'PAYMENT'].includes(type)) {
      rememberAcceptedSalesEvent(event, payload, eventSalesId, type, index);
    }

    if (type === 'MASTER_DATA' && payload.kind === 'MASTER_DATA_PATCH' && isRecord(payload.changes)) {
      const customers = payload.changes.customers;
      if (Array.isArray(customers)) {
        for (const candidate of customers) {
          if (!isRecord(candidate)) continue;
          const id = text(candidate.id);
          if (!id) continue;
          if (isUmumCustomer(candidate)) {
            index.umumCustomerIds.add(id);
            index.customerSales.delete(id);
          } else {
            index.umumCustomerIds.delete(id);
            const assigned = text(candidate.assignedSalesId);
            if (/^[a-zA-Z0-9_-]{1,100}$/.test(assigned)) index.customerSales.set(id, assigned);
            else index.customerSales.delete(id);
          }
        }
      }
    } else if (type === 'SALE') {
      const salesId = text(payload.salesId);
      const invoiceNumber = text(payload.invoiceNumber);
      const customerId = text(payload.customerId);
      if (salesId && invoiceNumber && customerId) {
        const receivable = isRecord(payload.receivable) ? payload.receivable : {};
        const allocations = Array.isArray(payload.lotAllocations) ? payload.lotAllocations.flatMap((item) => {
          if (!isRecord(item)) return [];
          const lotId = text(item.lotId), weightGram = Number(item.weightGram);
          if (!lotId || !Number.isSafeInteger(weightGram) || weightGram <= 0) return [];
          return [{
            lotId,
            lotCode: text(item.lotCode),
            productId: text(item.productId),
            productName: text(item.productName),
            weightGram,
          }];
        }) : [];
        const soldProducts = Array.isArray(payload.items) ? payload.items.flatMap((item) => {
          if (!isRecord(item)) return [];
          const productId = text(item.productId);
          const weightGram = Number(item.weightGram);
          const lineTotalRupiah = Number(item.lineTotalRupiah);
          if (!productId || !Number.isSafeInteger(weightGram) || weightGram <= 0 ||
              !Number.isSafeInteger(lineTotalRupiah) || lineTotalRupiah < 0) return [];
          return [{ productId, weightGram, lineTotalRupiah }];
        }) : [];
        const receivableRemaining = Number(receivable.amount);
        index.invoices.set(invoiceNumber, {
          salesId,
          customerId,
          allocations,
          soldProducts,
          returnedByProduct: new Map(),
          ...(text(receivable.id) ? { receivableId: text(receivable.id) } : {}),
          ...(Number.isSafeInteger(receivableRemaining) && receivableRemaining >= 0 ? { receivableRemaining } : {}),
        });
        const history = index.salesCustomerHistory.get(salesId) ?? new Set<string>();
        history.add(customerId);
        index.salesCustomerHistory.set(salesId, history);
      }
    } else if (type === 'RETURN') {
      const salesId = text(payload.salesId);
      const invoiceNo = text(payload.invoiceNo);
      const mediaId = text(payload.evidenceMediaId);
      const invoice = index.invoices.get(invoiceNo);
      const productId = text(payload.productId);
      const weightGram = Number(payload.weightGram);
      const soldProduct = invoice?.soldProducts.find((item) => item.productId === productId);
      const priorReturned = invoice?.returnedByProduct.get(productId) ?? 0;
      if (invoice && !invoice.voided && soldProduct && Number.isSafeInteger(weightGram) && weightGram > 0 &&
          priorReturned + weightGram <= soldProduct.weightGram) {
        invoice.returnedByProduct.set(productId, priorReturned + weightGram);
        const refund = Number(payload.estimatedRefundValue);
        if (payload.resolution === 'CREDIT_NOTE' && invoice.receivableRemaining !== undefined &&
            Number.isSafeInteger(refund) && refund >= 0) {
          invoice.receivableRemaining = Math.max(0, invoice.receivableRemaining - refund);
        }
        if (mediaId && invoice.salesId === salesId) index.media.set(mediaId, { salesId, invoiceNo });
      }
    } else if (type === 'PAYMENT' && payload.kind === 'RECEIVABLE_PAYMENT') {
      const invoice = index.invoices.get(text(payload.invoice));
      const amount = Number(payload.amountRupiah);
      if (invoice && invoice.receivableRemaining !== undefined && Number.isSafeInteger(amount) && amount > 0) {
        invoice.receivableRemaining = Math.max(0, invoice.receivableRemaining - amount);
      }
    } else if (type === 'PAYMENT' && payload.kind === 'RECEIVABLE_PAYMENT_REVERT') {
      const invoice = index.invoices.get(text(payload.invoice));
      const amount = Number(payload.amountRupiah);
      if (invoice && invoice.receivableRemaining !== undefined && Number.isSafeInteger(amount) && amount > 0) {
        invoice.receivableRemaining += amount;
      }
    } else if (type === 'VOID') {
      const invoice = index.invoices.get(text(payload.invoiceNumber));
      if (invoice) invoice.voided = true;
    }
  }
  return index;
}

export function authorizeSalesSyncEvent(
  eventValue: unknown,
  salesId: string,
  index: SalesOwnershipIndex
): { allowed: boolean; reason?: string } {
  if (!isRecord(eventValue)) return { allowed: false, reason: 'Format event Sales tidak valid.' };
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(salesId)) return { allowed: false, reason: 'Identitas Sales server tidak valid.' };
  const type = text(eventValue.entityType).toUpperCase();
  const payload = eventPayload(eventValue);
  if (text(payload.salesId) !== salesId) {
    return { allowed: false, reason: 'Identitas Sales pada event tidak sesuai membership terautentikasi.' };
  }

  const eventUuid = text(eventValue.uuid);
  const idempotencyKey = text(eventValue.idempotencyKey ?? eventValue.idempotency_key);
  const priorEvent = idempotencyKey ? index.acceptedEvents.get(idempotencyKey) : undefined;
  if (priorEvent) {
    const exactRetry = eventUuid === priorEvent.uuid &&
      salesId === priorEvent.salesId &&
      type === priorEvent.entityType &&
      stableStringify(payload) === priorEvent.payloadFingerprint;
    return exactRetry
      ? { allowed: true }
      : { allowed: false, reason: 'Idempotency key Sales sudah dipakai oleh event lain atau payload berubah.' };
  }

  if (type === 'SALE') {
    const customerId = text(payload.customerId);
    const invoiceNumber = text(payload.invoiceNumber);
    if (!customerId || !invoiceNumber || index.invoices.has(invoiceNumber)) {
      return { allowed: false, reason: 'Pelanggan atau nomor faktur tidak valid/duplikat.' };
    }
    const isUmum = index.umumCustomerIds.has(customerId) || customerId.toUpperCase() === 'CUST_UMUM';
    if (!isUmum && index.customerSales.get(customerId) !== salesId) {
      return { allowed: false, reason: 'Pelanggan tidak ditugaskan kepada Sales yang sedang login.' };
    }
    if (isUmum && payload.paymentMethod !== 'CASH' && payload.paymentMethod !== 'TRANSFER') {
      return { allowed: false, reason: 'Pelanggan UMUM hanya mendukung pembayaran CASH atau TRANSFER langsung.' };
    }
    const receivable = isRecord(payload.receivable) ? payload.receivable : {};
    const allocations = Array.isArray(payload.lotAllocations) ? payload.lotAllocations.flatMap((item) => {
      if (!isRecord(item)) return [];
      const lotId = text(item.lotId), weightGram = Number(item.weightGram);
      if (!lotId || !Number.isSafeInteger(weightGram) || weightGram <= 0) return [];
      return [{
        lotId, lotCode: text(item.lotCode), productId: text(item.productId),
        productName: text(item.productName), weightGram,
      }];
    }) : [];
    const soldProducts = Array.isArray(payload.items) ? payload.items.flatMap((item) => {
      if (!isRecord(item)) return [];
      const productId = text(item.productId);
      const weightGram = Number(item.weightGram);
      const lineTotalRupiah = Number(item.lineTotalRupiah);
      if (!productId || !Number.isSafeInteger(weightGram) || weightGram <= 0 ||
          !Number.isSafeInteger(lineTotalRupiah) || lineTotalRupiah < 0) return [];
      return [{ productId, weightGram, lineTotalRupiah }];
    }) : [];
    const receivableRemaining = Number(receivable.amount);
    index.invoices.set(invoiceNumber, {
      salesId,
      customerId,
      allocations,
      soldProducts,
      returnedByProduct: new Map(),
      ...(text(receivable.id) ? { receivableId: text(receivable.id) } : {}),
      ...(Number.isSafeInteger(receivableRemaining) && receivableRemaining >= 0 ? { receivableRemaining } : {}),
    });
    rememberAcceptedSalesEvent(eventValue, payload, salesId, type, index);
    return { allowed: true };
  }

  if (type === 'RETURN') {
    const invoiceNo = text(payload.invoiceNo);
    const invoice = index.invoices.get(invoiceNo);
    const refund = payload.estimatedRefundValue;
    const productId = text(payload.productId);
    const weightGram = Number(payload.weightGram);
    const soldProduct = invoice?.soldProducts.find((item) => item.productId === productId);
    const priorReturned = invoice?.returnedByProduct.get(productId) ?? 0;
    const resolution = text(payload.resolution);
    if (!invoice || invoice.salesId !== salesId || invoice.customerId !== text(payload.customerId) || invoice.voided) {
      return { allowed: false, reason: 'Retur tidak berasal dari faktur aktif dan pelanggan milik Sales ini.' };
    }
    if (!soldProduct || !Number.isSafeInteger(weightGram) || weightGram <= 0 ||
        priorReturned + weightGram > soldProduct.weightGram) {
      return { allowed: false, reason: 'Kuantitas retur tidak cocok dengan sisa produk pada faktur.' };
    }
    const expectedRefund = Math.round((weightGram * soldProduct.lineTotalRupiah) / soldProduct.weightGram);
    if (!Number.isSafeInteger(refund) || Number(refund) !== expectedRefund || Number(refund) < 0 || Number(refund) > 500000) {
      return { allowed: false, reason: 'Nilai retur tidak sesuai nilai proporsional faktur atau melebihi batas Sales Rp500.000.' };
    }
    if (!['CREDIT_NOTE', 'REFUND_KAS', 'TUKAR_BARANG'].includes(resolution)) {
      return { allowed: false, reason: 'Resolusi retur tidak valid.' };
    }
    if (resolution === 'CREDIT_NOTE' &&
        (invoice.receivableRemaining === undefined || invoice.receivableRemaining < Number(refund))) {
      return { allowed: false, reason: 'Saldo piutang faktur tidak cukup untuk credit note.' };
    }
    invoice.returnedByProduct.set(productId, priorReturned + weightGram);
    if (resolution === 'CREDIT_NOTE') invoice.receivableRemaining = Math.max(0, (invoice.receivableRemaining ?? 0) - Number(refund));
    const mediaId = text(payload.evidenceMediaId);
    if (mediaId) index.media.set(mediaId, { salesId, invoiceNo });
    rememberAcceptedSalesEvent(eventValue, payload, salesId, type, index);
    return { allowed: true };
  }

  if (type === 'PAYMENT' && payload.kind === 'RECEIVABLE_PAYMENT') {
    const invoiceNo = text(payload.invoice);
    const invoice = index.invoices.get(invoiceNo);
    const amount = payload.amountRupiah;
    if (!invoice || invoice.salesId !== salesId || invoice.voided ||
        !invoice.receivableId || text(payload.recId) !== invoice.receivableId ||
        invoice.receivableRemaining === undefined ||
        !['CASH', 'TRANSFER'].includes(text(payload.paymentMethod)) ||
        !Number.isSafeInteger(amount) || Number(amount) <= 0 || Number(amount) > invoice.receivableRemaining) {
      return { allowed: false, reason: 'Pembayaran tidak cocok dengan sisa piutang faktur milik Sales ini.' };
    }
    invoice.receivableRemaining -= Number(amount);
    rememberAcceptedSalesEvent(eventValue, payload, salesId, type, index);
    return { allowed: true };
  }

  return { allowed: false, reason: 'Sales tidak diizinkan mengirim jenis event ini.' };
}

export function authorizeSalesMedia(mediaId: string, salesId: string, index: SalesOwnershipIndex): boolean {
  const ownership = index.media.get(mediaId);
  return Boolean(ownership && ownership.salesId === salesId);
}

export function buildSalesPullPage(
  records: Array<Record<string, unknown>>,
  sinceSeq: number,
  deviceId: string,
  salesId: string,
  index: SalesOwnershipIndex,
  lastServerSeq: number,
  pageSize = 500
): { records: Array<Record<string, unknown>>; lastServerSeq: number } {
  const available = records
    .filter((record) => Number(record.serverSeq ?? record.server_seq) > sinceSeq &&
      String(record.deviceId ?? record.device_id) !== deviceId)
    .sort((a, b) => Number(a.serverSeq ?? a.server_seq) - Number(b.serverSeq ?? b.server_seq));
  const page = available.slice(0, pageSize);
  const pageCursor = available.length > pageSize
    ? Number(page[page.length - 1]?.serverSeq ?? page[page.length - 1]?.server_seq ?? sinceSeq)
    : Math.max(sinceSeq, lastServerSeq);
  const projected = page
    .map((record) => projectSalesPullRecord(record, salesId, index))
    .filter((record): record is Record<string, unknown> => record !== null);
  return { records: projected, lastServerSeq: pageCursor };
}

/** Convert the shared raw event stream into the minimum safe operational delta for one Sales identity. */
export function projectSalesPullRecord(
  raw: Record<string, unknown>,
  salesId: string,
  index: SalesOwnershipIndex
): Record<string, unknown> | null {
  const type = text(raw.entityType ?? raw.entity_type).toUpperCase();
  const payload = eventPayload(raw);
  const base = {
    serverSeq: raw.serverSeq ?? raw.server_seq,
    uuid: raw.uuid ?? raw.queue_id,
    idempotencyKey: raw.idempotencyKey ?? raw.idempotency_key,
    createdAt: raw.createdAt ?? raw.created_at,
    serverReceivedAt: raw.serverReceivedAt ?? raw.server_received_at,
  };

  if (type === 'MASTER_DATA' && payload.kind === 'MASTER_DATA_PATCH' && payload.snapshot === true && isRecord(payload.changes)) {
    const collection = text(payload.collection) as 'products' | 'lots' | 'customers' | 'categories' | 'bazarPromos';
    const allowed = new Set(['products', 'lots', 'customers', 'categories', 'bazarPromos']);
    const rows = payload.changes[collection];
    if (!allowed.has(collection) || !Array.isArray(rows)) return null;
    let safeRows: Array<RecordValue | null>;
    if (collection === 'products') safeRows = rows.map((row) => pickFields(row, PRODUCT_FIELDS));
    else if (collection === 'lots') safeRows = rows.map((row) => pickFields(row, LOT_FIELDS));
    else if (collection === 'customers') {
      safeRows = rows
        .filter((row) => isRecord(row) && (index.umumCustomerIds.has(text(row.id)) || index.customerSales.get(text(row.id)) === salesId || index.salesCustomerHistory.get(salesId)?.has(text(row.id)) === true))
        .map((row) => pickFields(row, CUSTOMER_FIELDS));
    } else if (collection === 'categories') safeRows = rows.map((row) => pickFields(row, CATEGORY_FIELDS));
    else safeRows = rows.map((row) => pickFields(row, PROMO_FIELDS));
    return {
      ...base,
      entityType: 'SALES_SNAPSHOT',
      summary: 'Bootstrap data operasional Sales',
      payload: {
        snapshotId: text(payload.snapshotId),
        salesId,
        collection,
        part: payload.part,
        totalParts: payload.totalParts,
        rows: safeRows.filter(Boolean),
      },
    };
  }

  if (type === 'MASTER_DATA' && payload.kind === 'MASTER_DATA_PATCH' && isRecord(payload.changes)) {
    const changes = payload.changes;
    const safeChanges: RecordValue = {};
    if (Array.isArray(changes.products)) {
      safeChanges.products = changes.products.map((row) => pickFields(row, PRODUCT_FIELDS)).filter(Boolean);
    }
    if (Array.isArray(changes.lots)) {
      safeChanges.lots = changes.lots.map((row) => pickFields(row, LOT_FIELDS)).filter(Boolean);
    }
    if (Array.isArray(changes.customers)) {
      safeChanges.customers = changes.customers
        .filter((row) => isRecord(row) && (index.umumCustomerIds.has(text(row.id)) || index.customerSales.get(text(row.id)) === salesId || index.salesCustomerHistory.get(salesId)?.has(text(row.id)) === true))
        .map((row) => pickFields(row, CUSTOMER_FIELDS)).filter(Boolean);
    }
    if (Array.isArray(changes.categories)) {
      safeChanges.categories = changes.categories.map((row) => pickFields(row, CATEGORY_FIELDS)).filter(Boolean);
    }
    if (Array.isArray(changes.bazarPromos)) {
      safeChanges.bazarPromos = changes.bazarPromos.map((row) => pickFields(row, PROMO_FIELDS)).filter(Boolean);
    }
    if (!Object.keys(safeChanges).length) return null;
    return { ...base, entityType: 'MASTER_DATA', summary: 'Pembaruan katalog dan stok', payload: { kind: 'MASTER_DATA_PATCH', changes: safeChanges } };
  }

  if (type === 'SALE') {
    const invoice = index.invoices.get(text(payload.invoiceNumber));
    if (!invoice) return null;
    if (invoice.salesId !== salesId) {
      if (!invoice.allocations.length) return null;
      return {
        ...base,
        entityType: 'SALES_STOCK',
        summary: 'Perubahan stok penjualan',
        payload: { kind: 'SALE_STOCK_OUT', lotAllocations: invoice.allocations },
      };
    }
    return { ...base, entityType: 'SALE', summary: 'Pembaruan transaksi Sales', payload: redactCosts(payload) };
  }

  if (type === 'RETURN') {
    const invoice = index.invoices.get(text(payload.invoiceNo));
    if (text(payload.salesId) !== salesId || !invoice || invoice.salesId !== salesId) return null;
    return { ...base, entityType: 'RETURN', summary: 'Pembaruan retur Sales', payload: redactCosts(payload) };
  }

  if (type === 'PAYMENT' && payload.kind === 'RECEIVABLE_PAYMENT') {
    const invoice = index.invoices.get(text(payload.invoice));
    if (text(payload.salesId) !== salesId || !invoice || invoice.salesId !== salesId) return null;
    return { ...base, entityType: 'PAYMENT', summary: 'Pembaruan pembayaran pelanggan', payload: { kind: 'RECEIVABLE_PAYMENT', salesId, recId: text(payload.recId), invoice: text(payload.invoice), amountRupiah: payload.amountRupiah, paymentMethod: payload.paymentMethod === 'TRANSFER' ? 'TRANSFER' : 'CASH' } };
  }

  if (type === 'VOID') {
    const invoice = index.invoices.get(text(payload.invoiceNumber));
    if (!invoice) return null;
    if (invoice.salesId !== salesId) {
      if (!invoice.allocations.length) return null;
      return {
        ...base,
        entityType: 'SALES_STOCK',
        summary: 'Pemulihan stok pembatalan',
        payload: { kind: 'VOID_STOCK_IN', lotAllocations: invoice.allocations },
      };
    }
    return {
      ...base,
      entityType: 'SALES_VOID',
      summary: 'Pembaruan status transaksi',
      payload: {
        transactionUuid: text(payload.transactionUuid),
        invoiceNumber: text(payload.invoiceNumber),
        reason: 'Dibatalkan oleh Owner',
      },
    };
  }

  if (type === 'PURCHASE') {
    const weightGram = payload.actualWeightGram;
    if (!Number.isSafeInteger(weightGram) || Number(weightGram) <= 0) return null;
    return {
      ...base,
      entityType: 'SALES_STOCK',
      summary: 'Pembaruan stok masuk',
      payload: {
        kind: 'PURCHASE_RECEIVED',
        productId: text(payload.productId),
        lotId: text(payload.lotId),
        lotCode: text(payload.lotCode),
        expiryDate: text(payload.expiryDate),
        weightGram: Number(weightGram),
        loc: text(payload.loc) || 'FREEZER-A-01',
      },
    };
  }

  if (type === 'OPNAME') {
    if (payload.kind === 'OPENING_BANK_BALANCE') return null;
    if (payload.kind === 'NEW_PRODUCT_OPENING_LOT') {
      const product = pickFields(payload.product, PRODUCT_FIELDS);
      const lot = pickFields(payload.lot, LOT_FIELDS);
      if (!product || !lot) return null;
      return {
        ...base,
        entityType: 'OPNAME',
        summary: 'Pembaruan stok awal',
        payload: { kind: 'NEW_PRODUCT_OPENING_LOT', product, lot, referenceNo: text(payload.referenceNo) },
      };
    }
    if (!text(payload.lotId) || !Number.isSafeInteger(payload.physicalWeightGram) || Number(payload.physicalWeightGram) < 0) return null;
    return {
      ...base,
      entityType: 'OPNAME',
      summary: 'Pembaruan hasil cek fisik stok',
      payload: {
        lotId: text(payload.lotId),
        physicalWeightGram: Number(payload.physicalWeightGram),
        referenceNo: text(payload.referenceNo),
        reason: 'Penyesuaian stok',
      },
    };
  }

  if (type === 'CONVERSION') {
    return { ...base, entityType: 'CONVERSION', summary: 'Pembaruan hasil pengolahan stok', payload: redactCosts(payload) };
  }

  return null;
}
