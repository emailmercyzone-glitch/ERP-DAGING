import test from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedCorsOrigin, parseAllowedOrigins } from './cors.ts';

test('CORS allowlist includes Capacitor and configured production origins', () => {
  const allowed = parseAllowedOrigins({
    appUrl: 'https://erp.example.com/app',
    corsOrigins: 'https://api.example.com, https://portal.example.com/',
    includeDevOrigins: false,
  });

  assert.equal(isAllowedCorsOrigin('https://localhost', allowed), true);
  assert.equal(isAllowedCorsOrigin('capacitor://localhost', allowed), true);
  assert.equal(isAllowedCorsOrigin('https://erp.example.com', allowed), true);
  assert.equal(isAllowedCorsOrigin('https://api.example.com', allowed), true);
  assert.equal(isAllowedCorsOrigin('https://portal.example.com', allowed), true);
  assert.equal(isAllowedCorsOrigin('http://localhost:5173', allowed), false);
  assert.equal(isAllowedCorsOrigin('https://untrusted.example.com', allowed), false);
});

test('development origins are included only when explicitly enabled', () => {
  const production = parseAllowedOrigins({ includeDevOrigins: false });
  const development = parseAllowedOrigins({ includeDevOrigins: true });

  assert.equal(isAllowedCorsOrigin('http://localhost:5173', production), false);
  assert.equal(isAllowedCorsOrigin('http://localhost:5173', development), true);
  assert.equal(isAllowedCorsOrigin('http://127.0.0.1:5173', development), true);
});
