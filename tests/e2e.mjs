// Test end-to-end w prawdziwej przeglądarce (Chromium przez Playwright).
// Serwuje katalog public/ z nagłówkami z public/_headers, wypełnia formularze, pobiera PDF
// i sprawdza jego treść (pdftotext). Wykrywa błędy JS, naruszenia CSP i Trusted Types.
// Część 2: paywall Stripe – /api/verify i strona płatności są atrapami (page.route).
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
  assert.ok(await page.locator('#partner-empty').isVisible(), 'neutralne „Miejsce dla partnera” bez konfiguracji');
  assert.ok((await page.locator('#partner-empty').innerText()).includes('Miejsce dla partnera – kontakt'));
  assert.equal(await page.locator('[data-price]').first().innerText(), '9,99\u00a0zł');
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
  assert.ok(await page.locator('#co-pane').isVisible(), 'najpierw okno zamówienia');
  assert.ok(await page.locator('#co-demo').isVisible(), 'tryb demonstracyjny na 127.0.0.1 bez linku płatności');
  assert.ok(await page.locator('#dl-pane').isHidden());
  await page.click('#co-pay');
  assert.ok((await page.locator('#co-error').innerText()).includes('Zaznacz obie zgody'), 'zgody są obowiązkowe');
  await page.click('[data-doc="terms-body"]');
  assert.ok((await page.locator('#doc-body').innerText()).includes('art. 38 ust. 1 pkt 13'), 'regulamin w oknie');
  await page.keyboard.press('Escape');
  assert.ok(await page.locator('#doc-modal').isHidden());
  assert.ok(await page.locator('#modal').isVisible(), 'Escape zamyka tylko regulamin');
  await page.check('#co-terms');
  await page.check('#co-withdraw');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.click('#co-pay')]);
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
  assert.ok(await page.locator('#dl-pane').isVisible(), 'po zamówieniu (demo) pobieranie bez ponownej płatności');
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

  step = 'konfiguracja: partner (tylko https) i dane sprzedawcy';
  const CONFIG_SRC = readFileSync(path.join(PUBLIC, 'assets', 'config.js'), 'utf8');
  const withConfig = (partnerUrl) => CONFIG_SRC
    .replace('enabled: false', 'enabled: true')
    .replace("title: ''", "title: 'Partner testowy'")
    .replace("url: ''", `url: '${partnerUrl}'`)
    .replace("name: '[imię i nazwisko / firma]'", "name: 'Jan Nowak'")
    .replace("email: '[e-mail kontaktowy]'", "email: 'kontakt@example.com'");
  let cfgBody = withConfig('https://partner.example.com/skd?utm_source=kzp');
  await page.route('**/assets/config.js', (route) => route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: cfgBody }));
  await page.goto(base);
  assert.ok(await page.locator('#partner').isVisible(), 'partner z poprawnym adresem https powinien być widoczny');
  assert.ok(await page.locator('#partner-empty').isHidden());
  assert.equal(await page.getAttribute('#partner-link', 'href'), 'https://partner.example.com/skd?utm_source=kzp');
  assert.equal(await page.getAttribute('#partner-link', 'rel'), 'sponsored noopener noreferrer');
  assert.equal(await page.getAttribute('#footer-contact', 'href'), 'mailto:kontakt@example.com');
  assert.ok((await page.locator('#regulamin').innerText()).includes('Jan Nowak'));
  cfgBody = withConfig('javascript:alert(1)');
  await page.goto(base);
  assert.equal(await page.locator('#partner').isHidden(), true, 'partner z adresem javascript: nie może się pokazać');
  assert.ok(await page.locator('#partner-empty').isVisible());
  await page.unroute('**/assets/config.js');

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

// ======================= Część 2: paywall (Stripe Payment Link + /api/verify) =======================
step = 'paywall: start';
try {
  const SID = 'cs_test_a1B2c3D4e5F6g7H8';
  const PAY_URL = 'https://buy.stripe.com/test_kzp123';
  const cfgPaid = readFileSync(path.join(PUBLIC, 'assets', 'config.js'), 'utf8').replace("paymentUrl: ''", `paymentUrl: '${PAY_URL}'`);
  assert.ok(cfgPaid.includes(PAY_URL));
  const pctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
  let verifyReady = true, orderRef = null, stripeHits = [], verifyCalls = [], downloads = 0;
  await pctx.route('**/assets/config.js', (route) => route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: cfgPaid }));
  await pctx.route('**/api/verify**', (route) => {
    const u = new URL(route.request().url());
    verifyCalls.push(u.search);
    if (u.searchParams.has('ping')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ready: verifyReady }) });
    const paid = !!orderRef && u.searchParams.get('ref') === orderRef && u.searchParams.get('session_id') === SID;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ paid }) });
  });
  await pctx.route('https://buy.stripe.com/**', (route) => { stripeHits.push(route.request().url()); return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Stripe (atrapa)</title><p>Płatność BLIK</p>' }); });
  const pp = await pctx.newPage();
  pp.on('pageerror', (e) => problems.push('paywall pageerror: ' + e.message));
  pp.on('console', (m) => { if (m.type() === 'error' && !pp.url().startsWith('https://buy.stripe.com')) problems.push('paywall console.error: ' + m.text()); });
  pp.on('download', () => { downloads++; });
  pp.on('dialog', (d) => d.accept());
  await pp.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => console.error('CSP violation: ' + e.violatedDirective + ' ' + e.blockedURI));
  });

  async function fillAll() {
    await pp.click('#loan-example');
    await pp.click('#loan-submit');
    await pp.fill('#b-name', 'Zofia Żółkiewska');
    await pp.fill('#b-street', 'ul. Świętej Jadwigi 3');
    await pp.fill('#b-postal', '90-001');
    await pp.fill('#b-city', 'Łódź');
    await pp.fill('#b-iban', '61109010140000071219812874');
    await pp.fill('#b-place', 'Łódź');
    await pp.fill('#b-date', '2026-10-24');
    await pp.locator('#b-place').blur();
  }
  async function openCheckout() {
    await pp.locator('#pdf-list button').first().click();
    assert.ok(await pp.locator('#modal').isVisible());
  }

  step = 'paywall: okno zamówienia, brak trybu demo, zablokowany podgląd';
  await pp.goto(base);
  await fillAll();
  await openCheckout();
  assert.ok(await pp.locator('#co-pane').isVisible());
  assert.ok(await pp.locator('#dl-pane').isHidden());
  assert.ok(await pp.locator('#co-demo').isHidden(), 'tryb demo wyłączony, gdy link płatności jest ustawiony');
  assert.ok(await pp.locator('#co-unavailable').isHidden());
  const modalText = await pp.locator('#modal-box').innerText();
  for (const s of ['REKLAMACJA', 'Wzywam do zapłaty', 'PL61', 'art. 49 ust. 1']) assert.ok(!modalText.includes(s), `podgląd zawiera treść płatnego pisma: ${s}`);

  step = 'paywall: serwer weryfikacji niegotowy → brak przekierowania';
  verifyReady = false;
  await pp.check('#co-terms');
  await pp.check('#co-withdraw');
  await pp.click('#co-pay');
  await pp.waitForFunction(() => !document.getElementById('co-error').hidden);
  assert.ok((await pp.locator('#co-error').innerText()).includes('Sprzedaż chwilowo niedostępna – nie pobraliśmy żadnych środków'));
  assert.equal(stripeHits.length, 0, 'nie wolno kierować do płatności');
  assert.ok(pp.url().startsWith(base));
  assert.equal(await pp.evaluate(() => localStorage.getItem('kzp.pay.v1')), null);
  await pp.click('#modal-close');

  step = 'paywall: samo ?platnosc=sukces nie odblokowuje';
  await pp.goto(base + '?platnosc=sukces');
  assert.equal(new URL(pp.url()).search, '', 'parametry płatności usunięte z adresu');
  await fillAll();
  await openCheckout();
  assert.ok(await pp.locator('#co-pane').isVisible(), '?platnosc=sukces nie może odblokować PDF');
  assert.ok(await pp.locator('#dl-pane').isHidden());
  await pp.click('#modal-close');
  await pp.goto(base + '?platnosc=sukces&session_id=' + SID);
  await pp.waitForTimeout(500);
  await fillAll();
  await openCheckout();
  assert.ok(await pp.locator('#co-pane').isVisible(), 'session_id bez zamówienia z tej przeglądarki nie odblokowuje');
  await pp.click('#modal-close');

  step = 'paywall: spreparowany localStorage nie odblokowuje';
  await pp.evaluate((sid) => {
    localStorage.setItem('kzp.pay.v1', JSON.stringify({ ref: 'wFAKEFAKEFAKEFAKEFAKEFAKE', sid, ts: Date.now(), paid: true }));
    localStorage.setItem('kzp.paid', 'true');
    localStorage.setItem('unlocked', '1');
  }, SID);
  verifyCalls = [];
  await pp.goto(base + '?platnosc=sukces&session_id=' + SID);
  await pp.waitForFunction(() => !document.getElementById('toast').hidden && document.getElementById('toast').textContent.includes('Nie udało się potwierdzić'), null, { timeout: 20000 });
  assert.equal(verifyCalls.filter((q) => q.includes('session_id')).length, 4, 'weryfikacja + 3 ponowienia');
  await fillAll();
  await openCheckout();
  assert.ok(await pp.locator('#co-pane').isVisible(), 'spreparowany localStorage nie może odblokować PDF');
  await pp.click('#modal-close');
  await pp.reload();
  await pp.waitForFunction(() => localStorage.getItem('kzp.pay.v1') === null, null, { timeout: 10000 });
  assert.equal(downloads, 0, 'żaden PDF nie mógł zostać pobrany bez płatności');

  step = 'paywall: płatność → powrót → weryfikacja → automatyczne pobranie PDF';
  verifyReady = true;
  await pp.evaluate(() => localStorage.clear());
  await pp.goto(base);
  await fillAll();
  await openCheckout();
  await pp.check('#co-terms');
  await pp.check('#co-withdraw');
  await Promise.all([pp.waitForURL(/^https:\/\/buy\.stripe\.com\//), pp.click('#co-pay')]);
  assert.equal(stripeHits.length, 1);
  const payUrl = new URL(stripeHits[0]);
  assert.equal(payUrl.origin + payUrl.pathname, PAY_URL);
  orderRef = payUrl.searchParams.get('client_reference_id');
  assert.match(orderRef, /^w[0-9a-f]{32}$/);
  assert.equal([...payUrl.searchParams.keys()].join(','), 'client_reference_id', 'żadnych danych osobowych w adresie płatności');
  verifyCalls = [];
  const [pdl] = await Promise.all([
    pp.waitForEvent('download', { timeout: 30000 }),
    pp.goto(base + '?platnosc=sukces&session_id=' + SID)
  ]);
  assert.ok(verifyCalls.some((q) => q.includes('ref=' + orderRef) && q.includes('session_id=' + SID)), 'weryfikacja z ref tego zamówienia');
  assert.equal(new URL(pp.url()).search, '');
  assert.match(pdl.suggestedFilename(), /^Reklamacja-zwrot-prowizji-Santander-Bank-Polska-S-A-2026-10-24\.pdf$/);
  const pdfPaid = path.join(outDir, 'oplacony-' + pdl.suggestedFilename());
  await pdl.saveAs(pdfPaid);
  const ptext = execFileSync('pdftotext', [pdfPaid, '-'], { encoding: 'utf8' }).replace(/\s+/g, ' ');
  for (const s of ['REKLAMACJA', 'Zofia Żółkiewska', 'ul. Świętej Jadwigi 3', '90-001 Łódź', 'PL61 1090 1014 0000 0712 1981 2874', '1 987,29 zł', '408,92 zł', 'Łódź, dnia 24.10.2026 r.', 'KG/2022/03/000123']) {
    assert.ok(ptext.includes(s), `opłacony PDF nie zawiera: ${s}`);
  }
  for (const ch of 'ąęłńóśźżŁŚŻ') assert.ok(ptext.includes(ch), `brak polskiego znaku w PDF: ${ch}`);
  await pp.waitForFunction(() => document.getElementById('modal-status').textContent.includes('Gotowe'));
  assert.equal(await pp.evaluate(() => sessionStorage.getItem('kzp.checkout.v1')), null, 'dane z płatności usunięte po pobraniu');

  step = 'paywall: po opłaceniu PDF zbiorczy bez ponownej płatności';
  await pp.click('#modal-close');
  await pp.click('#pdf-list button');
  assert.ok(await pp.locator('#dl-pane').isVisible());
  await pctx.close();
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
