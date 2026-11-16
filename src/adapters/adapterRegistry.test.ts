import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBackendConfig } from './adapterRegistry.ts';

test('legacy GAS endpoint and shared secret are scrubbed from browser adapter config', () => {
  const normalized = normalizeBackendConfig({
    adapterType: 'GOOGLE_SHEETS',
    storeId: 'STORE-ERP',
    endpointUrl: 'https://script.google.com/macros/s/private/exec',
    apiKeyOrToken: 'legacy-gas-shared-secret',
    updatedAt: new Date(0).toISOString(),
  });
  assert.equal(normalized.endpointUrl, '');
  assert.equal(normalized.apiKeyOrToken, '');
  assert.equal(normalized.storeId, 'STORE-ERP');
});

test('non-GAS adapter credentials remain available to their configured adapter', () => {
  const normalized = normalizeBackendConfig({
    adapterType: 'REST_API',
    storeId: 'STORE-ERP',
    endpointUrl: 'https://api.example.test',
    apiKeyOrToken: 'rest-token',
    updatedAt: new Date(0).toISOString(),
  });
  assert.equal(normalized.endpointUrl, 'https://api.example.test');
  assert.equal(normalized.apiKeyOrToken, 'rest-token');
});
