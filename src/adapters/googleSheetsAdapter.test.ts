import test from 'node:test';
import assert from 'node:assert/strict';
import { GoogleSheetsBackendAdapter } from './googleSheetsAdapter.ts';
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
