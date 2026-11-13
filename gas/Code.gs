/**
 * ERP DAGING — Google Apps Script sync gateway (Phase 1)
 *
 * Deploy as Web App:
 * - Execute as: Me
 * - Who has access: Anyone (the shared secret below authenticates requests)
 * - Script Properties: SPREADSHEET_ID (required), SYNC_SHARED_SECRET (recommended)
 * The spreadsheet is an append-only event log. Do not edit/delete rows manually.
 */
const ERP_SYNC_SHEET = 'ERP_SYNC_EVENTS';
const ERP_SYNC_HEADERS = ['serverSeq','storeId','deviceId','uuid','idempotencyKey','entityType','createdAt','summary','payloadJson'];

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    assertSecret_(p.token || '');
    const action = p.action || 'health';
    if (action === 'health') return json_({ ok: true, service: 'ERP DAGING Sync Gateway', serverTime: new Date().toISOString() });
    if (action !== 'sync_pull') throw new Error('Action GET tidak dikenal.');
    const storeId = String(p.storeId || '').trim();
    const deviceId = String(p.deviceId || '').trim();
    const sinceSeq = Math.max(0, Number(p.sinceSeq || 0));
    if (!storeId || !deviceId || !Number.isFinite(sinceSeq)) throw new Error('storeId, deviceId, sinceSeq wajib valid.');
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
        summary: String(r[7]), payload: payload
      });
    });
    records.sort((a, b) => a.serverSeq - b.serverSeq);
    const page = records.slice(0, 500);
    const pageCursor = records.length > 500 ? page[page.length - 1].serverSeq : lastServerSeq;
    return json_({ ok: true, records: page, lastServerSeq: pageCursor });
  } catch (err) {
    return json_({ ok: false, records: [], message: String(err && err.message || err) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    assertSecret_(String(body.sharedSecret || ''));
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
    existing.forEach((r) => idempotencyMap.set(String(r[4]), Number(r[0])));
    let nextSeq = Math.max(0, lastRow - 1);
    const ackIds = [];
    const serverSeqs = {};
    const appendRows = [];
    events.forEach((ev) => {
      const uuid = String(ev.uuid || '').trim();
      const key = String(ev.idempotencyKey || '').trim();
      if (!uuid || !key) throw new Error('Setiap event wajib memiliki uuid dan idempotencyKey.');
      const scopedKey = storeId + ':' + key;
      if (idempotencyMap.has(scopedKey)) {
        ackIds.push(uuid);
        serverSeqs[uuid] = idempotencyMap.get(scopedKey);
        return;
      }
      nextSeq += 1;
      const payload = ev.payload && typeof ev.payload === 'object' ? ev.payload : {};
      appendRows.push([nextSeq, storeId, deviceId, uuid, key, String(ev.entityType || 'UNKNOWN'), String(ev.createdAt || new Date().toISOString()), String(ev.summary || ''), JSON.stringify(payload)]);
      idempotencyMap.set(scopedKey, nextSeq);
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

function getSheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Script Property SPREADSHEET_ID belum diatur.');
  const ss = SpreadsheetApp.openById(id);
  let sheet = ss.getSheetByName(ERP_SYNC_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(ERP_SYNC_SHEET);
    sheet.getRange(1, 1, 1, ERP_SYNC_HEADERS.length).setValues([ERP_SYNC_HEADERS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function assertSecret_(provided) {
  const expected = PropertiesService.getScriptProperties().getProperty('SYNC_SHARED_SECRET') || '';
  if (expected && provided !== expected) throw new Error('Unauthorized: shared secret tidak valid.');
}

function assertRequiredSecret_(provided) {
  const expected = PropertiesService.getScriptProperties().getProperty('SYNC_SHARED_SECRET') || '';
  if (!expected) throw new Error('Script Property SYNC_SHARED_SECRET wajib diatur sebelum upload/unduh foto.');
  if (!provided || provided !== expected) throw new Error('Unauthorized: shared secret tidak valid.');
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
