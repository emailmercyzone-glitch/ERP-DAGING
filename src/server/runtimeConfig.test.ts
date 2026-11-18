import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveHost, resolvePort } from './runtimeConfig.ts';

test('port uses the deployment PORT environment variable', () => {
  assert.equal(resolvePort([], '8080'), 8080);
});

test('explicit CLI port overrides deployment environment', () => {
  assert.equal(resolvePort(['bun', 'server.ts', '--port', '4173'], '8080'), 4173);
});

test('invalid port values safely fall back to the default', () => {
  assert.equal(resolvePort([], 'not-a-port'), 3000);
  assert.equal(resolvePort([], '70000'), 3000);
  assert.equal(resolvePort(['bun', 'server.ts', '--port', '0'], '8080'), 8080);
});

test('host uses HOST environment and CLI takes precedence', () => {
  assert.equal(resolveHost([], '127.0.0.1'), '127.0.0.1');
  assert.equal(resolveHost(['bun', 'server.ts', '--host', 'localhost'], '0.0.0.0'), 'localhost');
});

test('host falls back to all interfaces when unset or blank', () => {
  assert.equal(resolveHost([], undefined), '0.0.0.0');
  assert.equal(resolveHost([], '   '), '0.0.0.0');
});
