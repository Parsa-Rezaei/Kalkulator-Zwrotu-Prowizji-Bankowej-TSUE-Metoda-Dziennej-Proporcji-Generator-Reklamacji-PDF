// Test end-to-end w prawdziwej przeglądarce (Chromium przez Playwright).
// Serwuje katalog public/ z nagłówkami z public/_headers, wypełnia formularze, pobiera PDF
// i sprawdza jego treść (pdftotext). Wykrywa błędy JS, naruszenia CSP i Trusted Types.
// Użycie: node tests/e2e.mjs [katalog-na-zrzuty]
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { PUBLIC } from '../scripts/lib.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const outDir = process.argv[2] || path.join(os.tmpdir(), 'kzp-e2e');
mkdirSync(outDir, { recursive: true });

// --- Minimalny serwer statyczny z nagłówkami z _headers (reguły ścieżek /*, /vendor/*) ---
const rules = [];
let cur = null;
for (const line of readFileSync(path.join(PUBLIC, '_headers'), 'utf8').split('\n')) {
  if (!line.trim() || line.startsWith('#')) continue;
  if (!/^\s/.test(line)) { cur = { pattern: line.trim(), headers: [] }; rules.push(cur); continue; }
  const i = line.indexOf(':');
  cur.headers.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]);
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml' };
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(PUBLIC, path.normalize(p));
  if (!file.startsWith(PUBLIC) || !existsSync(file) || p.includes('_headers')) { res.writeHead(404); res.end(); return; }
  for (const r of rules) {
    if (!r.pattern.startsWith('/')) continue;
    const re = new RegExp('^' + r.pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
    if (re.test(url.pathname)) for (const [k, v] of r.headers) res.setHeader(k, v);
  }
  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const problems = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`console.${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
page.on('dialog', (d) => { if (d.type() === 'alert') problems.push('alert: ' + d.message()); d.accept(); });
await page.addInitScript(() => {
  document.addEventListener('securitypolicyviolation', (e) => console.error('CSP violation: ' + e.violatedDirective + ' ' + e.blockedURI));
});

let step = 'start';
try {
  step = 'ładowanie strony';
  const resp = await page.goto(base);
  assert.equal(resp.headers()['x-frame-options'], 'DENY');
  assert.equal(await page.locator('#app-error').isHidden(), true);
  assert.equal(await page.locator('#partner').isHidden(), true, 'slot partnera ukryty bez konfiguracji');
  assert.equal(await page.evaluate(() => localStorage.length), 0);

  step = 'przykład kredytu';
  await page.click('#loan-example');
  await page.fill('#b-date', '2026-10-24');
  const prev = await page.locator('#loan-preview').innerText();
  for (const s of ['1826', '930', '896', '1\u00a0987,29\u00a0zł', '408,92\u00a0zł', '2\u00a0396,21\u00a0zł']) assert.ok(prev.includes(s), `podgląd nie zawiera ${s}: ${prev}`);

  step = 'dodanie do portfela + próba XSS w numerze umowy';
  await page.fill('#l-contract', '<img src=x onerror=alert(1)>KG/1');
  await page.click('#loan-submit');
  assert.equal(await page.locator('#portfolio-list > li').count(), 1);
  assert.equal(await page.locator('#portfolio-list img').count(), 0, 'XSS: wstrzyknięty element HTML');
  assert.ok((await page.locator('#portfolio-list').innerText()).includes('<img src=x onerror=alert(1)>KG/1'));

  step = 'drugi kredyt – hipoteczny w innym banku';
  await page.selectOption('#l-type', 'hipoteczny');
  await page.selectOption('#l-bank', 'citi');
  assert.equal(await page.inputValue('#l-bank-name'), 'Bank Handlowy w Warszawie S.A.');
  assert.ok(await page.locator('#l-bank-note').isVisible());
  await page.fill('#l-contract', 'HIP/2019/555');
  await page.fill('#l-start', '2019-05-10');
  await page.fill('#l-planned', '2049-05-10');
  await page.fill('#l-actual', '2025-05-10');
  await page.fill('#l-commission', '5 000,00');
  await page.click('#loan-submit');
  assert.equal(await page.locator('#portfolio-list > li').count(), 2);

  step = 'walidacja danych kredytobiorcy';
  assert.ok(await page.locator('#pdf-list button').first().isDisabled());
  await page.fill('#b-name', 'Jan Kowalski');
  await page.fill('#b-street', 'ul. Długa 5/7');
  await page.fill('#b-postal', '00-950');
  await page.fill('#b-city', 'Łódź');
  await page.fill('#b-iban', 'PL61 1090 1014 0000 0712 1981 2875');
  await page.locator('#b-iban').blur();
  assert.ok(await page.locator('#e-b-iban').isVisible(), 'błędny IBAN powinien być odrzucony');
  await page.fill('#b-iban', 'PL61 1090 1014 0000 0712 1981 2874');
  await page.fill('#b-email', 'jan@example.com');
  await page.fill('#b-place', 'Łódź');
  await page.fill('#b-date', '2026-10-24');
  await page.locator('#b-place').blur();
  assert.equal(await page.locator('#pdf-blocker').isHidden(), true);
  // 1 987,29 (konsumencki) + 3 999,82 (hipoteczny: 5000 × 8766 / 10958) = 5 987,11; odsetki 408,92 (tylko konsumencki)
  assert.equal(await page.locator('#sum-claim').innerText(), '5\u00a0987,11\u00a0zł');
  assert.equal(await page.locator('#sum-interest').innerText(), '408,92\u00a0zł');
  assert.equal(await page.locator('#sum-total').innerText(), '6\u00a0396,03\u00a0zł');
  await page.screenshot({ path: path.join(outDir, 'desktop.png'), fullPage: true });

  step = 'PDF dla jednego banku';
  assert.equal(await page.locator('#pdf-list > li').count(), 2);
  await page.locator('#pdf-list button').first().click();
  assert.ok(await page.locator('#modal').isVisible());
  assert.ok(await page.locator('#modal-support').isHidden(), 'przycisk wsparcia ukryty bez konfiguracji');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.click('#modal-download')]);
  const pdf1 = path.join(outDir, dl.suggestedFilename());
  await dl.saveAs(pdf1);
  assert.match(dl.suggestedFilename(), /^Reklamacja-zwrot-prowizji-Santander-Bank-Polska-S-A-2026-10-24\.pdf$/);
  await page.waitForFunction(() => document.getElementById('modal-status').textContent.includes('Gotowe'));
  await page.click('#modal-close');

  step = 'treść PDF';
  const text = execFileSync('pdftotext', [pdf1, '-'], { encoding: 'utf8' }).replace(/\s+/g, ' ');
  for (const s of ['REKLAMACJA', 'Santander Bank Polska S.A.', 'al. Jana Pawła II 17', 'Jan Kowalski', 'ul. Długa 5/7', '00-950 Łódź',
    'PL61 1090 1014 0000 0712 1981 2874', '1826', '930', '896', '1 987,29 zł', '408,92 zł', '2 396,21 zł',
    'jeden tysiąc dziewięćset osiemdziesiąt siedem złotych 29/100', 'C-383/18', 'art. 49 ust. 1', 'art. 52', 'art. 481 § 1 i 2',
    'nie później niż w terminie 30 dni', 'zgodnie z wolą klienta', 'Rzecznika Finansowego', 'jan@example.com',
    'Załącznik obliczeniowy', '9,25%', '11,25%', 'Łódź, dnia 24.10.2026 r.', '<img src=x onerror=alert(1)>KG/1']) {
    assert.ok(text.includes(s), `PDF nie zawiera: ${s}`);
  }
  assert.ok(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(text), 'brak polskich znaków w PDF');
  assert.ok(!text.includes('art. 39'), 'pismo konsumenckie nie powinno cytować art. 39');

  step = 'PDF zbiorczy';
  await page.click('#pdf-all');
  const [dl2] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.click('#modal-download')]);
  const pdf2 = path.join(outDir, dl2.suggestedFilename());
  await dl2.saveAs(pdf2);
  const text2 = execFileSync('pdftotext', [pdf2, '-'], { encoding: 'utf8' }).replace(/\s+/g, ' ');
  for (const s of ['Bank Handlowy w Warszawie S.A.', 'Do wiadomości:', 'VeloBank S.A.', 'art. 39 ust. 1', 'HIP/2019/555', 'art. 455']) {
    assert.ok(text2.includes(s), `PDF zbiorczy nie zawiera: ${s}`);
  }
  await page.click('#modal-close');

  step = 'pamięć przeglądarki – opt-in, przywracanie, usuwanie';
  assert.equal(await page.evaluate(() => localStorage.length), 0, 'bez zgody nic nie zapisujemy');
  await page.check('#remember');
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => localStorage.length), 1);
  await page.reload();
  assert.equal(await page.locator('#portfolio-list > li').count(), 2);
  assert.equal(await page.inputValue('#b-name'), 'Jan Kowalski');
  await page.click('#wipe');
  assert.equal(await page.evaluate(() => localStorage.length), 0);
  assert.equal(await page.locator('#portfolio-list > li').count(), 0);

  step = 'spreparowane dane w localStorage';
  await page.evaluate(() => localStorage.setItem('kzp.v1', JSON.stringify({ v: 1, borrower: { name: '<b>x</b>\u202e', __proto__: { polluted: 1 } }, loans: [{ bankKey: '__proto__', type: 'x', contract: '<svg onload=alert(1)>', start: '2022-01-01', planned: '2025-01-01', actual: '2023-01-01', commission: '100', bankName: 'B', bankStreet: 'S', bankCity: 'C' }] })));
  await page.reload();
  assert.equal(await page.inputValue('#b-name'), '<b>x</b>');
  assert.equal(await page.locator('#portfolio-list svg').count(), 0);
  assert.equal(await page.evaluate(() => ({}).polluted), undefined);

  step = 'konfiguracja: wsparcie i partner (tylko https)';
  const withConfig = (partnerUrl, coffeeUrl) => readFileSync(path.join(PUBLIC, 'index.html'), 'utf8')
    .replace('"buyCoffeeUrl": ""', `"buyCoffeeUrl": "${coffeeUrl}"`)
    .replace('"enabled": false', '"enabled": true')
    .replace('"cta": "Sprawdź umowę za darmo",\n    "url": ""', `"cta": "Sprawdź umowę za darmo",\n    "url": "${partnerUrl}"`)
    .replace('"name": "",\n    "email": ""', '"name": "Jan Nowak",\n    "email": "kontakt@example.com"');
  let body = withConfig('https://partner.example.com/skd?utm_source=kzp', 'https://buycoffee.to/test');
  await page.route(base, (route) => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body }));
  await page.goto(base);
  assert.ok(await page.locator('#partner').isVisible(), 'partner z poprawnym adresem https powinien być widoczny');
  assert.equal(await page.getAttribute('#partner-link', 'href'), 'https://partner.example.com/skd?utm_source=kzp');
  assert.equal(await page.getAttribute('#partner-link', 'rel'), 'sponsored noopener noreferrer');
  assert.equal(await page.getAttribute('#modal-support', 'href'), 'https://buycoffee.to/test');
  assert.ok((await page.locator('#owner-info').innerText()).includes('kontakt@example.com'));
  body = withConfig('javascript:alert(1)', 'http://buycoffee.to/test');
  await page.goto(base);
  assert.equal(await page.locator('#partner').isHidden(), true, 'partner z adresem javascript: nie może się pokazać');
  assert.equal(await page.getAttribute('#modal-support', 'href'), null, 'adres http: (bez TLS) nie może zostać użyty');
  await page.unroute(base);

  step = 'widok mobilny';
  const mob = await browser.newPage({ viewport: { width: 375, height: 800 } });
  mob.on('pageerror', (e) => problems.push('mobile pageerror: ' + e.message));
  await mob.goto(base);
  await mob.click('#loan-example');
  const overflow = await mob.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, `poziome przewijanie na telefonie: ${overflow}px`);
  await mob.screenshot({ path: path.join(outDir, 'mobile.png'), fullPage: true });
} catch (e) {
  problems.push(`[${step}] ${e.message}`);
}
await browser.close();
server.close();

if (problems.length) {
  console.error('E2E: BŁĘDY\n- ' + problems.join('\n- '));
  process.exit(1);
}
console.log('E2E: OK (zrzuty i PDF w ' + outDir + ')');
