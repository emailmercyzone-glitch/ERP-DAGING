/**
 * ERP DAGING — Google Apps Script sync gateway (Phase 1)
 *
 * Deploy as Web App:
 * - Execute as: Me
 * - Who has access: Anyone (the shared secret below authenticates requests)
 * - Script Properties: SPREADSHEET_ID and SYNC_SHARED_SECRET (both required)
 * The spreadsheet is an append-only event log. Do not edit/delete rows manually.
 */
const ERP_SYNC_SHEET = 'ERP_SYNC_EVENTS';
const ERP_SYNC_HEADERS = ['serverSeq','storeId','deviceId','uuid','idempotencyKey','entityType','createdAt','summary','payloadJson','serverReceivedAt'];

function doGet(e) {
  const p = (e && e.parameter) || {};
  const action = p.action || 'health';
  if (Object.prototype.hasOwnProperty.call(p, 'token') || Object.prototype.hasOwnProperty.call(p, 'sharedSecret')) {
    return json_({ ok: false, message: 'Autentikasi melalui URL tidak diizinkan. Gunakan POST dengan sharedSecret di body.' });
  }
  if (action === 'health' || action === 'sync_pull') {
    return json_({ ok: false, message: 'Action ini wajib menggunakan POST; token tidak boleh dikirim melalui URL.' });
  }
  return json_({ ok: false, message: 'Action GET tidak dikenal.' });
}


/** Accept requests only from the authenticated server-side gateway. */
function assertGatewaySignature_(body) {
  const auth = body && body.gatewayAuth;
  const secret = PropertiesService.getScriptProperties().getProperty('GAS_GATEWAY_HMAC_SECRET') || '';
  if (secret.length < 32) throw new Error('Script Property GAS_GATEWAY_HMAC_SECRET wajib diatur.');
  if (!auth || typeof auth !== 'object' || Array.isArray(auth)) throw new Error('Signature gateway wajib ada.');
  const timestamp = String(auth.timestamp || '');
  const nonce = String(auth.nonce || '');
  const provided = String(auth.signature || '');
  const timestampMs = Number(timestamp);
  if (!/^\d{13}$/.test(timestamp) || !Number.isSafeInteger(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
    throw new Error('Timestamp gateway kedaluwarsa atau tidak valid.');
  }
  if (!/^[a-f0-9]{32}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(provided)) {
    throw new Error('Nonce atau signature gateway tidak valid.');
  }
  const signedBody = {};
  Object.keys(body).forEach(function(key) { if (key !== 'gatewayAuth') signedBody[key] = body[key]; });
  const message = timestamp + '.' + nonce + '.' + stableJson_(signedBody);
  const digest = Utilities.computeHmacSha256Signature(message, secret);
  const expected = digest.map(function(byte) {
    const unsigned = byte < 0 ? byte + 256 : byte;
    return ('0' + unsigned.toString(16)).slice(-2);
  }).join('');
  if (expected !== provided) throw new Error('Signature gateway tidak cocok.');
  const cache = CacheService.getScriptCache();
  const cacheKey = 'erp-gas-nonce-' + nonce;
  if (cache.get(cacheKey)) throw new Error('Request gateway terdeteksi replay.');
  cache.put(cacheKey, '1', 300);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    assertGatewaySignature_(body);
    assertRequiredSecret_(String(body.sharedSecret || ''));
    if (body.action === 'health') {
      return json_({ ok: true, service: 'ERP DAGING Sync Gateway', serverTime: new Date().toISOString() });
    }
    if (body.action === 'sync_pull') {
      return pullChanges_(body);
    }
    if (body.action === 'media_upload' || body.action === 'media_download') {
      assertRequiredSecret_(String(body.sharedSecret || ''));
      const storeId = String(body.storeId || '').trim();
      const mediaId = String(body.mediaId || '').trim();
      const safeStoreId = storeId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
      if (!safeStoreId || !/^[a-zA-Z0-9_-]{1,100}$/.test(mediaId)) {
        throw new Error('storeId atau mediaId tidak valid.');
      }
      const folderName = 'ERP DAGING - Bukti Transaksi';
      const folders = DriveApp.getFoldersByName(folderName);
      const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
      const filename = safeStoreId + '__' + mediaId + '.jpg';

      if (body.action === 'media_download') {
        const files = folder.getFilesByName(filename);
        if (!files.hasNext()) return json_({ ok: false, message: 'Bukti foto belum tersedia di server.' });
        const file = files.next();
        const fileBlob = file.getBlob();
        if (fileBlob.getBytes().length > 1024 * 1024) throw new Error('File bukti di server melebihi batas 1 MB.');
        return json_({
          ok: true,
          fileId: file.getId(),
          mimeType: fileBlob.getContentType() || 'image/jpeg',
          dataBase64: Utilities.base64Encode(fileBlob.getBytes())
        });
      }

      const mimeType = String(body.mimeType || '');
      const encoded = String(body.dataBase64 || '');
      if (mimeType !== 'image/jpeg' || !encoded || encoded.length > 1400000) {
        throw new Error('Upload hanya menerima foto JPEG maksimal 1 MB.');
      }
      const bytes = Utilities.base64Decode(encoded);
      if (bytes.length <= 0 || bytes.length > 1024 * 1024) throw new Error('Ukuran foto harus lebih dari 0 dan maksimal 1 MB.');
      const existing = folder.getFilesByName(filename);
      if (existing.hasNext()) {
        const prior = existing.next();
        return json_({ ok: true, fileId: prior.getId(), mediaId: mediaId, duplicate: true });
      }
      const blob = Utilities.newBlob(bytes, 'image/jpeg', filename);
      const file = folder.createFile(blob);
      file.setDescription('ERP DAGING | Store: ' + safeStoreId + ' | Media ID: ' + mediaId);
      return json_({ ok: true, fileId: file.getId(), mediaId: mediaId });
    }
    if (body.action !== 'sync_push') throw new Error('Action POST tidak dikenal.');
    const storeId = String(body.storeId || '').trim();
    const deviceId = String(body.deviceId || '').trim();
    const events = Array.isArray(body.events) ? body.events : [];
    if (!storeId || !deviceId || !events.length) throw new Error('storeId, deviceId, dan events wajib diisi.');
    if (events.length > 200) throw new Error('Maksimal 200 event per batch.');
    const sheet = getSheet_();
    const lastRow = sheet.getLastRow();
    const existing = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, ERP_SYNC_HEADERS.length).getValues() : [];
    const idempotencyMap = new Map();
    const uuidMap = new Map();
    let nextSeq = 0;
    existing.forEach((r) => {
      const existingStoreId = String(r[1] || '').trim();
      const existingDeviceId = String(r[2] || '').trim();
      const existingUuid = String(r[3] || '').trim();
      const existingIdempotencyKey = String(r[4] || '').trim();
      const existingPayloadJson = String(r[8] || '{}');
      const record = {
        seq: Number(r[0]),
        deviceId: existingDeviceId,
        uuid: existingUuid,
        idempotencyKey: existingIdempotencyKey,
        entityType: String(r[5] || 'UNKNOWN'),
        createdAt: String(r[6] || ''),
        summary: String(r[7] || ''),
        payloadJson: existingPayloadJson
      };
      if (Number.isSafeInteger(record.seq) && record.seq > nextSeq) nextSeq = record.seq;
      if (existingStoreId && existingIdempotencyKey) {
        idempotencyMap.set(existingStoreId + ':' + existingIdempotencyKey, record);
      }
      if (existingStoreId && existingUuid) {
        uuidMap.set(existingStoreId + ':' + existingUuid, record);
      }
    });
    const ackIds = [];
    const serverSeqs = {};
    const appendRows = [];
    events.forEach((ev) => {
      const uuid = String(ev.uuid || '').trim();
      const key = String(ev.idempotencyKey || '').trim();
      const createdAt = String(ev.createdAt || '').trim();
      if (!uuid || !key || !createdAt) throw new Error('Setiap event wajib memiliki uuid, idempotencyKey, dan createdAt.');
      const validated = validateSyncEvent_(ev);
      const record = {
        deviceId: deviceId,
        uuid: uuid,
        idempotencyKey: key,
        entityType: validated.entityType,
        createdAt: validated.createdAt,
        summary: validated.summary,
        payloadJson: stableJson_(validated.payload),
        serverReceivedAt: new Date().toISOString()
      };
      const scopedKey = storeId + ':' + key;
      const scopedUuid = storeId + ':' + uuid;
      if (idempotencyMap.has(scopedKey)) {
        const prior = idempotencyMap.get(scopedKey);
        if (!sameSyncEvent_(prior, record)) {
          throw new Error('Konflik idempotencyKey: kunci sudah dipakai untuk event dengan isi atau identitas berbeda.');
        }
        ackIds.push(uuid);
        serverSeqs[uuid] = prior.seq;
        return;
      }
      if (uuidMap.has(scopedUuid)) {
        throw new Error('Konflik UUID: event dengan UUID ini sudah tercatat menggunakan idempotencyKey lain.');
      }
      nextSeq += 1;
      record.seq = nextSeq;
      appendRows.push([nextSeq, storeId, deviceId, uuid, key, record.entityType, record.createdAt, record.summary, record.payloadJson, record.serverReceivedAt]);
      idempotencyMap.set(scopedKey, record);
      uuidMap.set(scopedUuid, record);
      ackIds.push(uuid);
      serverSeqs[uuid] = nextSeq;
    });
    if (appendRows.length) sheet.getRange(sheet.getLastRow() + 1, 1, appendRows.length, ERP_SYNC_HEADERS.length).setValues(appendRows);
    return json_({ ok: true, acknowledgedIds: ackIds, serverSeqs, lastServerSeq: nextSeq, message: ackIds.length + ' event di-ACK.' });
  } catch (err) {
    return json_({ ok: false, acknowledgedIds: [], serverSeqs: {}, message: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function pullChanges_(body) {
  const storeId = String(body.storeId || '').trim();
  const deviceId = String(body.deviceId || '').trim();
  const sinceSeq = body.sinceSeq === undefined ? 0 : body.sinceSeq;
  if (!storeId || !deviceId || !Number.isSafeInteger(sinceSeq) || sinceSeq < 0) {
    throw new Error('storeId, deviceId, sinceSeq wajib berupa cursor integer aman non-negatif.');
  }
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return json_({ ok: true, records: [], lastServerSeq: 0 });
  const rows = sheet.getRange(2, 1, lastRow - 1, ERP_SYNC_HEADERS.length).getValues();
  const records = [];
  let lastServerSeq = sinceSeq;
  rows.forEach((r) => {
    const seq = Number(r[0]) || 0;
    if (seq > lastServerSeq) lastServerSeq = seq;
    if (seq <= sinceSeq || String(r[1]) !== storeId || String(r[2]) === deviceId) return;
    let payload = {};
    try { payload = JSON.parse(String(r[8] || '{}')); } catch (_) {}
    records.push({
      serverSeq: seq, storeId: String(r[1]), deviceId: String(r[2]), uuid: String(r[3]),
      idempotencyKey: String(r[4]), entityType: String(r[5]), createdAt: String(r[6]),
      summary: String(r[7]), payload: payload,
      serverReceivedAt: String(r[9] || '')
    });
  });
  records.sort((a, b) => a.serverSeq - b.serverSeq);
  const page = records.slice(0, 500);
  const pageCursor = records.length > 500 ? page[page.length - 1].serverSeq : lastServerSeq;
  return json_({ ok: true, records: page, lastServerSeq: pageCursor });
}


/**
 * Validate the ERP DAGING event contract before any append/ACK.
 * This is deliberately an allow-list: unknown event types and payload variants
 * must fail closed rather than be stored and acknowledged as usable business data.
 */
function validateSyncEvent_(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) throw new Error('Event harus berupa objek.');
  const uuid = String(event.uuid || '').trim();
  const idempotencyKey = String(event.idempotencyKey || '').trim();
  const createdAt = String(event.createdAt || '').trim();
  const entityType = String(event.entityType || '').trim();
  const summary = String(event.summary || '').trim();
  const payload = event.payload;
  if (!uuid || uuid.length > 100 || !idempotencyKey || idempotencyKey.length > 160 || !createdAt || !summary) {
    throw new Error('uuid, idempotencyKey, createdAt, dan summary wajib valid.');
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(createdAt) || isNaN(Date.parse(createdAt))) {
    throw new Error('createdAt wajib berupa timestamp ISO-8601 UTC.');
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || Object.keys(payload).length === 0) {
    throw new Error('Payload event wajib berupa objek tidak kosong.');
  }
  const allowed = ['SALE','PURCHASE','OPNAME','CONVERSION','RETURN','PAYMENT','VOID','APPROVAL','MASTER_DATA'];
  if (allowed.indexOf(entityType) < 0) throw new Error('entityType tidak dikenal: ' + entityType);
  const required = function(keys) {
    keys.forEach(function(key) {
      if (!Object.prototype.hasOwnProperty.call(payload, key) || payload[key] === null || payload[key] === undefined || payload[key] === '') {
        throw new Error(entityType + ' payload wajib memiliki ' + key + '.');
      }
    });
  };
  const text = function(key) {
    if (typeof payload[key] !== 'string' || !payload[key].trim()) throw new Error(entityType + ' payload ' + key + ' harus berupa teks.');
  };
  const integer = function(key, allowZero) {
    const value = payload[key];
    if (!Number.isSafeInteger(value) || (allowZero ? value < 0 : value <= 0)) {
      throw new Error(entityType + ' payload ' + key + ' harus berupa integer aman' + (allowZero ? ' non-negatif.' : ' positif.'));
    }
  };
  if (entityType === 'SALE') {
    required(['transactionUuid','invoiceNumber','customerId','paymentMethod','totalWeightGram','grandTotalRupiah','items','lotAllocations']);
    ['transactionUuid','invoiceNumber','customerId','paymentMethod'].forEach(text);
    integer('totalWeightGram', false); integer('grandTotalRupiah', false); integer('subtotalRupiah', false);
    if (payload.discountRupiah !== undefined && !Number.isSafeInteger(payload.discountRupiah)) throw new Error('SALE discountRupiah wajib integer aman.');
    if (payload.shippingFee !== undefined && !Number.isSafeInteger(payload.shippingFee)) throw new Error('SALE shippingFee wajib integer aman.');
    if (['CASH','TRANSFER','TEMPO','MIX'].indexOf(payload.paymentMethod) < 0) throw new Error('SALE paymentMethod tidak valid.');
    if (!Array.isArray(payload.items) || payload.items.length === 0 || !Array.isArray(payload.lotAllocations)) throw new Error('SALE items wajib berisi baris dan lotAllocations wajib berupa array.');
    payload.items.forEach(function(item, index) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('SALE items[' + index + '] harus berupa objek.');
      ['productId','productName','weightGram','effectivePricePerKg','lineTotalRupiah','movingAvgHppPerKg'].forEach(function(key) {
        if (item[key] === undefined || item[key] === null || item[key] === '') throw new Error('SALE items[' + index + '].' + key + ' wajib diisi.');
      });
      ['weightGram','effectivePricePerKg','lineTotalRupiah','movingAvgHppPerKg'].forEach(function(key) {
        if (!Number.isSafeInteger(item[key]) || item[key] < 0) throw new Error('SALE items[' + index + '].' + key + ' wajib integer aman non-negatif.');
      });
    });
    payload.lotAllocations.forEach(function(item, index) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('SALE lotAllocations[' + index + '] harus berupa objek.');
      ['lotId','lotCode','weightGram','hppPerKg','cogsRupiah'].forEach(function(key) {
        if (item[key] === undefined || item[key] === null || item[key] === '') throw new Error('SALE lotAllocations[' + index + '].' + key + ' wajib diisi.');
      });
      ['weightGram','hppPerKg','cogsRupiah'].forEach(function(key) {
        if (!Number.isSafeInteger(item[key]) || item[key] < 0) throw new Error('SALE lotAllocations[' + index + '].' + key + ' wajib integer aman non-negatif.');
      });
    });
  } else if (entityType === 'PURCHASE') {
    required(['poId','poNumber','lotId','productId','actualWeightGram','hppKgRupiah','totalLandedCost']);
    ['poId','poNumber','lotId','productId'].forEach(text);
    integer('actualWeightGram', false); integer('hppKgRupiah', false); integer('totalLandedCost', true);
  } else if (entityType === 'OPNAME') {
    if (payload.kind === 'NEW_PRODUCT_OPENING_LOT') {
      required(['productId','sku','product','lot','lotCode','stockGram','hppKgRupiah','openingValue','referenceNo']);
      integer('stockGram', false); integer('hppKgRupiah', false); integer('openingValue', true);
    } else if (payload.kind === 'OPENING_BANK_BALANCE') {
      required(['openingBalanceRupiah','referenceNo']);
      integer('openingBalanceRupiah', true);
    } else {
      required(['referenceNo','lotId','lotCode','physicalWeightGram','systemWeightGram','hppKgRupiah','diffGram','reason']);
      integer('physicalWeightGram', true); integer('systemWeightGram', true); integer('hppKgRupiah', false);
    }
  } else if (entityType === 'CONVERSION') {
    required(['referenceNo','sourceLotId','inputGram','usableOutputGram','primaryGram','secondaryGram','lossGram','totalRawCost']);
    integer('inputGram', false); integer('usableOutputGram', true); integer('primaryGram', true);
    integer('secondaryGram', true); integer('lossGram', true); integer('totalRawCost', true);
  } else if (entityType === 'RETURN') {
    required(['returnNumber','invoiceNo','customerName','productName','weightGram','resolution','estimatedRefundValue']);
    integer('weightGram', false); integer('estimatedRefundValue', true);
  } else if (entityType === 'PAYMENT') {
    if (payload.kind === 'RECEIVABLE_PAYMENT' || payload.kind === 'RECEIVABLE_PAYMENT_REVERT') {
      required(['recId','invoice','customer','amountRupiah']);
      integer('amountRupiah', false);
      if (payload.kind === 'RECEIVABLE_PAYMENT') required(['paymentMethod']);
    } else if (payload.kind === 'SUPPLIER_PAYMENT') {
      required(['invoiceId','invoiceNumber','supplier','amountPaidRupiah','paymentMethod']);
      integer('amountPaidRupiah', false);
    } else if (payload.kind === 'PETTY_CASH_OPEX') {
      required(['voucherNo','categoryLabel','desc','amountRupiah']);
      integer('amountRupiah', false);
    } else if (payload.kind === 'PETTY_CASH_TOP_UP') {
      required(['source','amountRupiah']);
      if (payload.source !== 'KAS_UTAMA' && payload.source !== 'BANK') throw new Error('PETTY_CASH_TOP_UP source tidak valid.');
      integer('amountRupiah', false);
    } else {
      throw new Error('PAYMENT kind tidak dikenal.');
    }
  } else if (entityType === 'VOID') {
    required(['transactionUuid','invoiceNumber','reason']);
  } else if (entityType === 'APPROVAL') {
    required(['approvalUuid','approval','decision','resolvedBy']);
    if (payload.decision !== 'APPROVED' && payload.decision !== 'REJECTED') throw new Error('APPROVAL decision tidak valid.');
  } else if (entityType === 'MASTER_DATA') {
    if (payload.kind !== 'MASTER_DATA_PATCH' || !payload.changes || typeof payload.changes !== 'object' || Array.isArray(payload.changes) || Object.keys(payload.changes).length === 0) {
      throw new Error('MASTER_DATA hanya menerima MASTER_DATA_PATCH dengan changes tidak kosong.');
    }
    const changeKeys = Object.keys(payload.changes);
    const allowedChanges = ['products','lots','customers','inboundPOs','supplierInvoices','categories','bazarPromos'];
    changeKeys.forEach(function(changeKey) {
      if (allowedChanges.indexOf(changeKey) < 0) throw new Error('MASTER_DATA changes memuat field yang tidak diizinkan: ' + changeKey);
      const rows = payload.changes[changeKey];
      if (!Array.isArray(rows) || rows.length > 500) throw new Error('MASTER_DATA ' + changeKey + ' harus berupa array maksimal 500 baris.');
      const requiredByType = {
        products: ['id','sku','name','basePricePerKg','movingAvgHppPerKg','tierPrices','category','stockGram','safetyStockGram'],
        lots: ['id','code','product','daysLeft','expiryDate','weightGram','maxCapacityGram','hppKgRupiah','loc','isFefo','isQuarantined'],
        customers: ['id','code','name','tier','creditLimit','currentReceivable','termDays','phone','address'],
        inboundPOs: ['id','poNumber','supplier','container','eta','items','status','totalRupiah'],
        supplierInvoices: ['id','invoiceNumber','poNumber','supplier','originCountry','totalAmountRupiah','paidAmountRupiah','remainingAmountRupiah','dueDate','daysDiff','status'],
        categories: ['id','label','color'],
        bazarPromos: ['id','sku','promoPricePerKg','startDate','endDate','quotaKg','soldKg','isActive','badgeLabel']
      };
      rows.forEach(function(row, index) {
        if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('MASTER_DATA ' + changeKey + '[' + index + '] harus berupa objek.');
        requiredByType[changeKey].forEach(function(field) {
          if (!Object.prototype.hasOwnProperty.call(row, field) || row[field] === null || row[field] === undefined || row[field] === '') {
            throw new Error('MASTER_DATA ' + changeKey + '[' + index + '].' + field + ' wajib diisi.');
          }
        });
        if (typeof row.id !== 'string' || !row.id.trim()) throw new Error('MASTER_DATA ' + changeKey + '[' + index + '].id tidak valid.');
        if (changeKey === 'products') {
          if (!row.tierPrices || typeof row.tierPrices !== 'object' || Array.isArray(row.tierPrices) ||
              !['RETAIL','HOREKA','VIP'].every(function(tier) { return Number.isSafeInteger(row.tierPrices[tier]); })) {
            throw new Error('MASTER_DATA products[' + index + '].tierPrices harus berisi harga integer RETAIL/HOREKA/VIP.');
          }
        }
        if (changeKey === 'categories' && row.deletedAt !== undefined && row.deletedAt !== null &&
            (typeof row.deletedAt !== 'string' || isNaN(Date.parse(row.deletedAt)))) {
          throw new Error('MASTER_DATA categories[' + index + '].deletedAt tidak valid.');
        }
      });
    });
  }
  const integerMoneyKeys = ['basePricePerKg','movingAvgHppPerKg','effectivePricePerKg','unitCostPerKg','movingAvgHppAfterKg','hppPerKg','debit','credit','totalDebit','totalCredit','creditLimit','currentReceivable','amount','limit','totalRawCost','primaryNetCost','tetelanValue','effectiveSteakHpp','secondaryHpp'];
  const inspect = function(value, path) {
    if (value === null || value === undefined) return;
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Nilai numerik tidak valid pada ' + path + '.');
    const fieldName = path.split('.').pop().split('[')[0];
    if (typeof value === 'number' && (/(Rupiah|Gram)$/.test(fieldName) || integerMoneyKeys.indexOf(fieldName) >= 0 || path.indexOf('.tierPrices.') >= 0) && !Number.isSafeInteger(value)) {
      throw new Error('Nilai ' + path + ' wajib integer aman; pecahan/overflow ditolak.');
    }
    if (Array.isArray(value)) {
      if (value.length > 2000) throw new Error('Array payload terlalu besar pada ' + path + '.');
      value.forEach(function(item, index) { inspect(item, path + '[' + index + ']'); });
    } else if (typeof value === 'object') {
      Object.keys(value).forEach(function(key) { inspect(value[key], path ? path + '.' + key : key); });
    }
  };
  inspect(payload, 'payload');
  const payloadJson = stableJson_(payload);
  if (payloadJson.length > 45000) throw new Error('Payload event melebihi batas aman 45 KB.');
  return { uuid: uuid, idempotencyKey: idempotencyKey, createdAt: createdAt, entityType: entityType, summary: summary.slice(0, 500), payload: payload };
}

function stableJson_(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableJson_).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map((key) => JSON.stringify(key) + ':' + stableJson_(value[key])).join(',') + '}';
}

function sameSyncEvent_(a, b) {
  return a.deviceId === b.deviceId &&
    a.uuid === b.uuid &&
    a.idempotencyKey === b.idempotencyKey &&
    a.entityType === b.entityType &&
    a.createdAt === b.createdAt &&
    a.summary === b.summary &&
    stableJson_(JSON.parse(a.payloadJson || '{}')) === b.payloadJson;
}

function getSheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Script Property SPREADSHEET_ID belum diatur.');
  const ss = SpreadsheetApp.openById(id);
  let sheet = ss.getSheetByName(ERP_SYNC_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(ERP_SYNC_SHEET);
    sheet.setFrozenRows(1);
  }
  // Extend existing installations without rewriting historical event rows.
  const headerRange = sheet.getRange(1, 1, 1, ERP_SYNC_HEADERS.length);
  const currentHeaders = headerRange.getValues()[0] || [];
  if (ERP_SYNC_HEADERS.some((header, index) => String(currentHeaders[index] || '') !== header)) {
    headerRange.setValues([ERP_SYNC_HEADERS]);
  }
  return sheet;
}

function assertRequiredSecret_(provided) {
  const expected = PropertiesService.getScriptProperties().getProperty('SYNC_SHARED_SECRET') || '';
  if (!expected) throw new Error('Script Property SYNC_SHARED_SECRET wajib diatur sebelum upload/unduh foto.');
  if (!provided || provided !== expected) throw new Error('Unauthorized: shared secret tidak valid.');
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
