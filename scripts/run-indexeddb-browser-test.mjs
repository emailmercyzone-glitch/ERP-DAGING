import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const server = spawn('bunx', ['vite', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], {
  stdio: 'ignore',
});
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Vite test server exited with code ${server.exitCode}`);
    try {
      const response = await fetch('http://127.0.0.1:4173/scripts/indexeddb-browser-test.html');
      if (response.ok) { ready = true; break; }
    } catch { /* server is still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error('Vite test server tidak siap dalam 30 detik.');

  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('pageerror', (error) => console.error('Browser page error:', error.message));
  page.on('console', (message) => { if (message.type() === 'error') console.error('Browser console error:', message.text()); });
  page.on('requestfailed', (request) => console.error('Browser request failed:', request.url(), request.failure()?.errorText));

  await page.goto('http://127.0.0.1:4173/scripts/indexeddb-browser-test.html?phase=setup', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__IDB_BROWSER_TEST__?.status === 'passed' || window.__IDB_BROWSER_TEST__?.status === 'failed', { timeout: 30000 });
  const setup = await page.evaluate(() => window.__IDB_BROWSER_TEST__);
  if (setup?.status !== 'passed') throw new Error(`Setup test gagal:\n${setup?.details.join('\n') ?? 'Tidak ada hasil.'}`);
  console.log('Chromium IndexedDB setup tests:');
  for (const detail of setup.details) console.log(detail);

  await page.goto('http://127.0.0.1:4173/scripts/indexeddb-browser-test.html?phase=verify', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__IDB_BROWSER_TEST__?.status === 'passed' || window.__IDB_BROWSER_TEST__?.status === 'failed', { timeout: 30000 });
  const verify = await page.evaluate(() => window.__IDB_BROWSER_TEST__);
  if (verify?.status !== 'passed') throw new Error(`Reload verification gagal:\n${verify?.details.join('\n') ?? 'Tidak ada hasil.'}`);
  console.log('Chromium IndexedDB reload verification:');
  for (const detail of verify.details) console.log(detail);

  await page.goto('http://127.0.0.1:4173/scripts/indexeddb-browser-test.html?phase=replacement-verify', { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForFunction(() => window.__IDB_BROWSER_TEST__?.status === 'passed' || window.__IDB_BROWSER_TEST__?.status === 'failed', { timeout: 30000 });
  } catch (error) {
    const diagnostic = await page.evaluate(() => ({
      href: window.location.href,
      title: document.title,
      body: document.querySelector('#result')?.textContent,
      status: window.__IDB_BROWSER_TEST__?.status,
      details: window.__IDB_BROWSER_TEST__?.details,
    }));
    throw new Error(`Replacement reload phase did not publish a result: ${JSON.stringify(diagnostic)}; ${error instanceof Error ? error.message : String(error)}`);
  }
  const replacementVerify = await page.evaluate(() => window.__IDB_BROWSER_TEST__);
  if (replacementVerify?.status !== 'passed') throw new Error(`Replacement-device reload verification gagal:\\n${replacementVerify?.details.join('\\n') ?? 'Tidak ada hasil.'}`);
  console.log('Chromium replacement-device recovery after page reload:');
  for (const detail of replacementVerify.details) console.log(detail);
  console.log('BROWSER_INDEXEDDB_TESTS_PASSED');
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
