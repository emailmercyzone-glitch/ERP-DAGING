import test from 'node:test';
import assert from 'node:assert/strict';
import { GoogleSheetsBackendAdapter } from './googleSheetsAdapter.ts';
import { RestApiBackendAdapter } from './restApiAdapter.ts';
import { SupabaseBackendAdapter } from './supabaseAdapter.ts';
import type { BackendAdapterConfig } from './backendAdapter.ts';
import type { SyncOutboxItem } from '../engine/types.ts';

const config: BackendAdapterConfig = {
  adapterType: 'GOOGLE_SHEETS',
  storeId: 'ERP_DAGING_TEST',
  endpointUrl: 'https://script.google.com/macros/s/test/exec',
  apiKeyOrToken: 'test-secret',
  updatedAt: new Date(0).toISOString(),
};

test('GAS adapter push requires explicit ACK and captures server sequence', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    return new Response(JSON.stringify({ ok: true, acknowledgedIds: ['OUT-1'], serverSeqs: { 'OUT-1': 7 }, lastServerSeq: 7 }), { status: 200 });
  }) as typeof fetch;
  const adapter = new GoogleSheetsBackendAdapter(config, fakeFetch);
  const item: SyncOutboxItem = {
    uuid: 'OUT-1', idempotencyKey: 'IDEM-1', entityType: 'SALE',
    createdAt: new Date().toISOString(), status: 'PENDING', summary: 'Invoice test',
    payload: { invoiceNumber: 'INV-TEST' },
  };
  const result = await adapter.pushOutbox([item], { storeName: 'ERP DAGING', deviceId: 'DEVICE-A' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.acknowledgedIds, ['OUT-1']);
  assert.equal(result.serverSeqs['OUT-1'], 7);
  const body = JSON.parse(String(calls[0].init?.body));
  assert.equal(calls[0].init?.headers && (calls[0].init?.headers as Record<string, string>)['Content-Type'], 'text/plain;charset=utf-8');
  assert.equal(body.sharedSecret, 'test-secret');
  assert.equal(body.events[0].uuid, 'OUT-1');
});

test('GAS adapter pull returns remote events and cursor; health uses authenticated action', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const body = JSON.parse(String(init?.body || '{}'));
    if (body.action === 'sync_pull') {
      return new Response(JSON.stringify({
        ok: true, lastServerSeq: 11,
        records: [{ serverSeq: 11, uuid: 'REMOTE-1', idempotencyKey: 'REMOTE-KEY', entityType: 'SALE', payload: {} }],
      }), { status: 200 });
    }
    return new Response(JSON.stringify({ ok: true, serverTime: new Date().toISOString() }), { status: 200 });
  }) as typeof fetch;
  const adapter = new GoogleSheetsBackendAdapter(config, fakeFetch);
  const health = await adapter.checkHealth();
  assert.equal(health.ok, true);
  assert.equal(calls[0].url, config.endpointUrl);
  assert.equal(calls[0].init?.method, 'POST');
  assert.equal((calls[0].init?.headers as Record<string, string>)['Content-Type'], 'text/plain;charset=utf-8');
  const healthBody = JSON.parse(String(calls[0].init?.body));
  assert.equal(healthBody.action, 'health');
  assert.equal(healthBody.sharedSecret, 'test-secret');
  assert.equal(calls[0].url.includes('token='), false);

  const pulled = await adapter.pullChanges(5, { deviceId: 'DEVICE-B' });
  assert.equal(pulled.ok, true);
  assert.equal(pulled.lastServerSeq, 11);
  assert.equal(pulled.records[0].uuid, 'REMOTE-1');
  assert.equal(calls[1].url, config.endpointUrl);
  assert.equal(calls[1].init?.method, 'POST');
  const pullBody = JSON.parse(String(calls[1].init?.body));
  assert.deepEqual(pullBody, {
    action: 'sync_pull', sharedSecret: 'test-secret', storeId: 'ERP_DAGING_TEST',
    deviceId: 'DEVICE-B', sinceSeq: 5,
  });
  assert.equal(calls[1].url.includes('token='), false);
});


test('GAS adapter rejects HTTP 200 responses whose application payload reports failure', async () => {
  const fakeFetch = (async () =>
    new Response(JSON.stringify({ ok: false, message: 'SYNC_SHARED_SECRET belum diatur.' }), { status: 200 })
  ) as typeof fetch;
  const adapter = new GoogleSheetsBackendAdapter(config, fakeFetch);
  const health = await adapter.checkHealth();
  assert.equal(health.ok, false);
  assert.match(health.message, /SYNC_SHARED_SECRET/);
  const item: SyncOutboxItem = {
    uuid: 'OUT-FAIL', idempotencyKey: 'IDEM-FAIL', entityType: 'SALE',
    createdAt: new Date().toISOString(), status: 'PENDING', summary: 'Invoice gagal',
  };
  const pushed = await adapter.pushOutbox([item], { storeName: 'ERP DAGING', deviceId: 'DEVICE-A' });
  assert.equal(pushed.ok, false);
  assert.deepEqual(pushed.acknowledgedIds, []);
  assert.deepEqual(pushed.failedItems.map((entry) => entry.uuid), ['OUT-FAIL']);
});


test('GAS adapter ignores ACKs and server sequences for events outside the submitted batch', async () => {
  const fakeFetch = (async () =>
    new Response(JSON.stringify({
      ok: true,
      acknowledgedIds: ['OUT-1', 'NOT-SENT'],
      serverSeqs: { 'OUT-1': 9, 'NOT-SENT': 10 },
    }), { status: 200 })
  ) as typeof fetch;
  const adapter = new GoogleSheetsBackendAdapter(config, fakeFetch);
  const item: SyncOutboxItem = {
    uuid: 'OUT-1', idempotencyKey: 'IDEM-1', entityType: 'SALE',
    createdAt: new Date().toISOString(), status: 'PENDING', summary: 'Invoice test',
  };
  const result = await adapter.pushOutbox([item], { storeName: 'ERP DAGING', deviceId: 'DEVICE-A' });
  assert.deepEqual(result.acknowledgedIds, ['OUT-1']);
  assert.deepEqual(result.serverSeqs, { 'OUT-1': 9 });
});


test('REST adapter only accepts ACKs and server sequences for submitted events', async () => {
  const fakeFetch = (async () => new Response(JSON.stringify({
    acknowledgedIds: ['REST-1', 'NOT-SENT', 'REST-1'],
    acks: [{ uuid: 'REST-1', server_seq: 21 }, { uuid: 'NOT-SENT', server_seq: 99 }],
    serverSeqs: { 'REST-1': 21, 'NOT-SENT': 99 },
  }), { status: 200 })) as typeof fetch;
  const adapter = new RestApiBackendAdapter('REST_API', {
    ...config, adapterType: 'REST_API', endpointUrl: 'https://erp.example.test',
  }, fakeFetch);
  const items: SyncOutboxItem[] = [{
    uuid: 'REST-1', idempotencyKey: 'REST-IDEM-1', entityType: 'SALE',
    createdAt: new Date().toISOString(), status: 'PENDING', summary: 'REST test',
  }];
  const result = await adapter.pushOutbox(items, { storeName: 'ERP DAGING', deviceId: 'DEVICE-A' });
  assert.deepEqual(result.acknowledgedIds, ['REST-1']);
  assert.deepEqual(result.serverSeqs, { 'REST-1': 21 });
  assert.equal(result.failedItems.length, 0);
});

test('Supabase adapter only accepts ACKs and server sequences for submitted events', async () => {
  const fakeFetch = (async () => new Response(JSON.stringify({
    acks: [
      { queue_id: 'SUPA-1', server_seq: 31 },
      { queue_id: 'NOT-SENT', server_seq: 99 },
      { queue_id: 'SUPA-1', server_seq: 31 },
    ],
  }), { status: 200 })) as typeof fetch;
  const adapter = new SupabaseBackendAdapter({
    ...config, adapterType: 'SUPABASE',
    supabaseUrl: 'https://project.supabase.co', supabaseAnonKey: 'anon-test',
  }, fakeFetch);
  const items: SyncOutboxItem[] = [{
    uuid: 'SUPA-1', idempotencyKey: 'SUPA-IDEM-1', entityType: 'SALE',
    createdAt: new Date().toISOString(), status: 'PENDING', summary: 'Supabase test',
  }];
  const result = await adapter.pushOutbox(items, { storeName: 'ERP DAGING', deviceId: 'DEVICE-A' });
  assert.deepEqual(result.acknowledgedIds, ['SUPA-1']);
  assert.deepEqual(result.serverSeqs, { 'SUPA-1': 31 });
  assert.equal(result.failedItems.length, 0);
});


test('GAS adapter does not mark an ACK as synced without a valid positive server sequence', async () => {
  const fakeFetch = (async () => new Response(JSON.stringify({
    ok: true, acknowledgedIds: ['GAS-NO-SEQ'], serverSeqs: {},
  }), { status: 200 })) as typeof fetch;
  const adapter = new GoogleSheetsBackendAdapter(config, fakeFetch);
  const item: SyncOutboxItem = {
    uuid: 'GAS-NO-SEQ', idempotencyKey: 'GAS-IDEM-NO-SEQ', entityType: 'SALE',
    createdAt: new Date().toISOString(), status: 'PENDING', summary: 'Missing sequence',
  };
  const result = await adapter.pushOutbox([item], { storeName: 'ERP DAGING', deviceId: 'DEVICE-A' });
  assert.deepEqual(result.acknowledgedIds, []);
  assert.deepEqual(result.serverSeqs, {});
  assert.deepEqual(result.failedItems.map((entry) => entry.uuid), ['GAS-NO-SEQ']);
});

test('REST adapter does not mark an ACK as synced without a valid positive server sequence', async () => {
  const fakeFetch = (async () => new Response(JSON.stringify({
    acknowledgedIds: ['REST-NO-SEQ'],
  }), { status: 200 })) as typeof fetch;
  const adapter = new RestApiBackendAdapter('REST_API', {
    ...config, adapterType: 'REST_API', endpointUrl: 'https://erp.example.test',
  }, fakeFetch);
  const item: SyncOutboxItem = {
    uuid: 'REST-NO-SEQ', idempotencyKey: 'REST-IDEM-NO-SEQ', entityType: 'SALE',
    createdAt: new Date().toISOString(), status: 'PENDING', summary: 'Missing sequence',
  };
  const result = await adapter.pushOutbox([item], { storeName: 'ERP DAGING', deviceId: 'DEVICE-A' });
  assert.deepEqual(result.acknowledgedIds, []);
  assert.deepEqual(result.serverSeqs, {});
  assert.deepEqual(result.failedItems.map((entry) => entry.uuid), ['REST-NO-SEQ']);
});

test('Supabase adapter does not mark an ACK as synced without a valid positive server sequence', async () => {
  const fakeFetch = (async () => new Response(JSON.stringify({
    acks: [{ queue_id: 'SUPA-NO-SEQ' }],
  }), { status: 200 })) as typeof fetch;
  const adapter = new SupabaseBackendAdapter({
    ...config, adapterType: 'SUPABASE',
    supabaseUrl: 'https://project.supabase.co', supabaseAnonKey: 'anon-test',
  }, fakeFetch);
  const item: SyncOutboxItem = {
    uuid: 'SUPA-NO-SEQ', idempotencyKey: 'SUPA-IDEM-NO-SEQ', entityType: 'SALE',
    createdAt: new Date().toISOString(), status: 'PENDING', summary: 'Missing sequence',
  };
  const result = await adapter.pushOutbox([item], { storeName: 'ERP DAGING', deviceId: 'DEVICE-A' });
  assert.deepEqual(result.acknowledgedIds, []);
  assert.deepEqual(result.serverSeqs, {});
  assert.deepEqual(result.failedItems.map((entry) => entry.uuid), ['SUPA-NO-SEQ']);
});


test('REST adapter requires an explicit ACK as well as a valid server sequence', async () => {
  const fakeFetch = (async () => new Response(JSON.stringify({
    serverSeqs: { 'REST-SEQ-ONLY': 44 },
  }), { status: 200 })) as typeof fetch;
  const adapter = new RestApiBackendAdapter('REST_API', {
    ...config, adapterType: 'REST_API', endpointUrl: 'https://erp.example.test',
  }, fakeFetch);
  const item: SyncOutboxItem = {
    uuid: 'REST-SEQ-ONLY', idempotencyKey: 'REST-IDEM-SEQ-ONLY', entityType: 'SALE',
    createdAt: new Date().toISOString(), status: 'PENDING', summary: 'Sequence without ACK',
  };
  const result = await adapter.pushOutbox([item], { storeName: 'ERP DAGING', deviceId: 'DEVICE-A' });
  assert.deepEqual(result.acknowledgedIds, []);
  assert.deepEqual(result.serverSeqs, {});
  assert.deepEqual(result.failedItems.map((entry) => entry.uuid), ['REST-SEQ-ONLY']);
});
