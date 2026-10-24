// Kontrola przed publikacją – bez zależności (wystarczy Node.js 18+).
// Sprawdza: CSP i SRI, poprawność JSON (konfiguracja, JSON-LD), zgodność FAQ, nagłówki bezpieczeństwa
// oraz testy obliczeń (wartości oczekiwane policzone niezależnie w Pythonie: datetime + Decimal).
// Użycie: node scripts/check.mjs   (kod wyjścia 1 = błąd, nie publikuj)
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PUBLIC, INDEX, CSP_RE, VENDOR_RE, inlineHashes, buildCsp, vendorSri, loadCalc } from './lib.mjs';

const html = readFileSync(INDEX, 'utf8');
let failed = 0, passed = 0;
// Domena z <link rel="canonical"> – wszystkie pozostałe adresy muszą jej odpowiadać.
const canonical = /<link rel="canonical" href="(https:\/\/[a-z0-9.-]+)\/">/.exec(html);
if (!canonical) { console.error('BŁĄD: brak <link rel="canonical" href="https://domena/">'); process.exit(1); }
const ORIGIN = canonical[1];
function test(name, fn) {
  try { fn(); passed++; } catch (e) { failed++; console.error(`BŁĄD: ${name}\n  ${e.message}`); }
}

// ---------- Bezpieczeństwo i struktura ----------
test('CSP w index.html odpowiada aktualnym sumom skryptu i stylu', () => {
  const m = CSP_RE.exec(html);
  assert.ok(m, 'brak meta CSP');
  assert.equal(m[2], buildCsp(inlineHashes(html)), 'nieaktualne sumy CSP – uruchom: npm run build');
});
test('SRI bibliotek w public/vendor jest aktualne', () => {
  const found = [...html.matchAll(VENDOR_RE)];
  assert.equal(found.length, 2, 'oczekiwano 2 bibliotek');
  for (const [, file, sri] of found) assert.equal(sri, vendorSri(file), `nieaktualne SRI dla ${file}`);
});
test('Brak placeholderów BUILD i niebezpiecznych konstrukcji', () => {
  assert.ok(!html.includes('BUILD'), 'pozostał placeholder BUILD');
  const script = /<script id="app-js">([\s\S]*?)<\/script>/.exec(html)[1];
  for (const bad of ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write', 'eval(', 'new Function', 'setTimeout(\'', 'setTimeout("']) {
    assert.ok(!script.includes(bad), `niedozwolone: ${bad}`);
  }
  assert.ok(!/\son[a-z]+="/i.test(html.replace(/<script[\s\S]*?<\/script>/g, '')), 'inline event handler w HTML');
  assert.ok(!/<script[^>]+src=/.test(html), 'zewnętrzny <script src> w HTML (biblioteki ładowane są dynamicznie z SRI)');
  const own = ORIGIN.replace(/^https:\/\//, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ext = new RegExp(`https?:\\/\\/(?!schema\\.org|tailwindcss\\.com\\*\\/|${own}\\/)[a-z0-9.-]+`, 'i');
  assert.ok(!ext.test(html.replace(/"(buyCoffeeUrl|url)": "[^"]*"/g, '')), 'nieoczekiwany zewnętrzny adres w index.html');
});
test('Domena jest spójna: canonical, og:url, og:image, JSON-LD, robots.txt, sitemap.xml', () => {
  assert.ok(html.includes(`<meta property="og:url" content="${ORIGIN}/">`), 'og:url');
  assert.ok(html.includes(`<meta property="og:image" content="${ORIGIN}/og-image.png">`), 'og:image');
  assert.ok(html.includes(`"url": "${ORIGIN}/"`), 'JSON-LD url');
  assert.ok(readFileSync(path.join(PUBLIC, 'robots.txt'), 'utf8').includes(`Sitemap: ${ORIGIN}/sitemap.xml`), 'robots.txt');
  assert.ok(readFileSync(path.join(PUBLIC, 'sitemap.xml'), 'utf8').includes(`<loc>${ORIGIN}/</loc>`), 'sitemap.xml');
});
test('Bloki JSON (konfiguracja i JSON-LD) są poprawne', () => {
  const blocks = [...html.matchAll(/<script type="application\/(?:ld\+)?json"[^>]*>([\s\S]*?)<\/script>/g)];
  assert.equal(blocks.length, 3);
  for (const b of blocks) JSON.parse(b[1]);
});
test('FAQ w JSON-LD jest identyczne z widocznym FAQ', () => {
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  const faq = ld.find((x) => x['@type'] === 'FAQPage');
  assert.ok(faq);
  for (const q of faq.mainEntity) {
    assert.ok(html.includes(`<summary>${q.name}</summary><p>${q.acceptedAnswer.text}</p>`), `niezgodne FAQ: ${q.name}`);
  }
});
test('Pliki wdrożeniowe istnieją, nagłówki bezpieczeństwa są ustawione', () => {
  for (const f of ['_headers', 'robots.txt', 'sitemap.xml', 'favicon.svg', 'og-image.png']) assert.ok(existsSync(path.join(PUBLIC, f)), `brak public/${f}`);
  const h = readFileSync(path.join(PUBLIC, '_headers'), 'utf8');
  for (const k of ["frame-ancestors 'none'", 'X-Frame-Options: DENY', 'X-Content-Type-Options: nosniff', 'Strict-Transport-Security', 'Referrer-Policy: no-referrer', 'Permissions-Policy', 'Cross-Origin-Opener-Policy: same-origin']) {
    assert.ok(h.includes(k), `brak w _headers: ${k}`);
  }
});

// ---------- Obliczenia ----------
const C = loadCalc(html);
// Obiekty z kontekstu vm mają inne prototypy – porównujemy kopie.
const plain = (x) => JSON.parse(JSON.stringify(x));
const D = C.parseISODate;
const RATES = C.buildRates([]).rates;

test('parseISODate odrzuca nieistniejące daty', () => {
  assert.equal(D('2023-02-29'), null);
  assert.notEqual(D('2024-02-29'), null);
  assert.equal(D('2024-2-1'), null);
  assert.equal(D('2024-13-01'), null);
  assert.equal(D(''), null);
  assert.equal(C.dayToISO(D('2024-02-29')), '2024-02-29');
  assert.equal(C.formatDatePL(D('2026-03-05')), '05.03.2026');
});
test('parseMoney – formaty polskie, limity i odrzucanie niejednoznacznych', () => {
  assert.equal(C.parseMoney('3 450,00'), 345000);
  assert.equal(C.parseMoney('3450.5'), 345050);
  assert.equal(C.parseMoney('0,01'), 1);
  assert.equal(C.parseMoney(''), 0);
  assert.equal(C.parseMoney('1.234,56'), null);
  assert.equal(C.parseMoney('-5'), null);
  assert.equal(C.parseMoney('12,345'), null);
  assert.equal(C.parseMoney('abc'), null);
  assert.equal(C.parseMoney('10000000'), 1000000000);
  assert.equal(C.parseMoney('10000000,01'), null);
  assert.equal(C.parseMoney('100000000'), null);
});
test('formatMoney', () => {
  assert.equal(C.formatMoney(198729, ' '), '1 987,29 zł');
  assert.equal(C.formatMoney(1, ' '), '0,01 zł');
  assert.equal(C.formatMoney(123456789, ' '), '1 234 567,89 zł');
});
test('Metoda liniowa co do dnia – przykład z rokiem przestępnym', () => {
  const r = C.computeLoan({ type: 'konsumencki', startDay: D('2022-03-15'), plannedDay: D('2027-03-15'), actualDay: D('2024-09-30'), commission: 345000, otherFees: 60000, refunded: 0, creditAmount: 4000000 }, { docDay: D('2026-10-24'), rates: RATES });
  assert.deepEqual(plain(r.errors), []);
  assert.equal(r.totalDays, 1826);
  assert.equal(r.usedDays, 930);
  assert.equal(r.shortenedDays, 896);
  assert.equal(r.refund, 198729);
  assert.equal(r.claim, 198729);
  assert.equal(C.dayToISO(r.interestFrom), '2024-10-15');
  assert.deepEqual(plain(r.interestPeriods).map((p) => [C.dayToISO(p.from), C.dayToISO(p.to), p.days, p.bp, p.grosze]), [
    ['2024-10-15', '2025-05-07', 205, 1125, 12557],
    ['2025-05-08', '2025-07-02', 56, 1075, 3278],
    ['2025-07-03', '2025-09-03', 63, 1050, 3602],
    ['2025-09-04', '2025-10-08', 35, 1025, 1953],
    ['2025-10-09', '2025-11-05', 28, 1000, 1524],
    ['2025-11-06', '2025-12-03', 28, 975, 1486],
    ['2025-12-04', '2026-03-04', 91, 950, 4707],
    ['2026-03-05', '2026-10-24', 234, 925, 11785]
  ]);
  assert.equal(r.interest, 40892);
  assert.equal(r.total, 198729 + 40892);
});
test('Częściowy zwrot i brak odsetek przed 15. dniem', () => {
  const base = { type: 'konsumencki', startDay: D('2025-01-01'), plannedDay: D('2030-01-01'), actualDay: D('2026-10-20'), commission: 100000, otherFees: 0, refunded: 20000, creditAmount: 0 };
  const r = C.computeLoan(base, { docDay: D('2026-10-24'), rates: RATES });
  assert.equal(r.totalDays, 1826);
  assert.equal(r.shortenedDays, 1169);
  assert.equal(r.refund, 64020); // 100000 × 1169 / 1826 = 64019,71…
  assert.equal(r.claim, 44020);
  assert.equal(r.interest, 0);
  const r2 = C.computeLoan({ ...base, refunded: 70000 }, { docDay: D('2026-10-24'), rates: RATES });
  assert.equal(r2.claim, 0);
  assert.ok(r2.warnings.some((w) => w.includes('zwrócił już')));
});
test('Zaokrąglanie połówek grosza w górę', () => {
  // 1 gr × 1 / 2 = 0,5 gr -> 1 gr
  const r = C.computeLoan({ type: 'konsumencki', startDay: D('2026-01-01'), plannedDay: D('2026-01-03'), actualDay: D('2026-01-02'), commission: 1, otherFees: 0, refunded: 0, creditAmount: 0 }, { docDay: D('2026-01-02'), rates: RATES });
  assert.equal(r.refund, 1);
});
test('Błędy dat i kosztów', () => {
  const ctx = { docDay: D('2026-10-24'), rates: RATES };
  const ok = { type: 'konsumencki', startDay: D('2022-01-01'), plannedDay: D('2025-01-01'), actualDay: D('2023-01-01'), commission: 1000, otherFees: 0, refunded: 0, creditAmount: 0 };
  assert.ok(C.computeLoan({ ...ok, actualDay: D('2025-01-01') }, ctx).errors.length > 0, 'spłata w terminie');
  assert.ok(C.computeLoan({ ...ok, plannedDay: D('2021-12-31') }, ctx).errors.length > 0, 'koniec przed startem');
  assert.ok(C.computeLoan({ ...ok, actualDay: D('2021-06-01') }, ctx).errors.length > 0, 'spłata przed startem');
  assert.ok(C.computeLoan({ ...ok, commission: 0 }, ctx).errors.length > 0, 'brak kosztów');
  assert.ok(C.computeLoan({ ...ok, actualDay: D('2026-12-01'), plannedDay: D('2027-12-01') }, ctx).errors.length > 0, 'spłata po dacie pisma');
  assert.ok(C.computeLoan({ ...ok, commission: null }, ctx).errors.length > 0, 'niepoprawna kwota');
});
test('Kredyt hipoteczny: bez odsetek do daty pisma, ostrzeżenie o sporze', () => {
  const r = C.computeLoan({ type: 'hipoteczny', startDay: D('2019-05-10'), plannedDay: D('2049-05-10'), actualDay: D('2025-05-10'), commission: 500000, otherFees: 0, refunded: 0, creditAmount: 0 }, { docDay: D('2026-10-24'), rates: RATES });
  assert.deepEqual(plain(r.errors), []);
  assert.equal(r.interest, 0);
  assert.equal(r.interestFrom, null);
  assert.ok(r.warnings.some((w) => w.includes('C-555/21')));
});
test('Ostrzeżenia: przedawnienie, limit kwoty, data umowy', () => {
  const ctx = { docDay: D('2026-10-24'), rates: RATES };
  const old = C.computeLoan({ type: 'konsumencki', startDay: D('2016-01-10'), plannedDay: D('2021-01-10'), actualDay: D('2018-01-10'), commission: 100000, otherFees: 0, refunded: 0, creditAmount: 30000000 }, ctx);
  assert.ok(old.warnings.some((w) => w.includes('przedawnione')));
  assert.ok(old.warnings.some((w) => w.includes('255 550')));
  const y2020 = C.computeLoan({ type: 'konsumencki', startDay: D('2019-01-10'), plannedDay: D('2024-01-10'), actualDay: D('2020-06-01'), commission: 100000, otherFees: 0, refunded: 0, creditAmount: 0 }, ctx);
  assert.ok(y2020.warnings.some((w) => w.includes('31.12.2026')));
  const pre2011 = C.computeLoan({ type: 'konsumencki', startDay: D('2011-06-01'), plannedDay: D('2016-06-01'), actualDay: D('2013-06-01'), commission: 100000, otherFees: 0, refunded: 0, creditAmount: 0 }, ctx);
  assert.ok(pre2011.warnings.some((w) => w.includes('18.12.2011')));
});
test('Tabela stóp i dodatkowe stawki z konfiguracji', () => {
  assert.equal(RATES.length, 26);
  assert.equal(C.dayToISO(RATES[RATES.length - 1].from), '2026-03-05');
  assert.equal(RATES[RATES.length - 1].bp, 925);
  for (let i = 1; i < RATES.length; i++) assert.ok(RATES[i].from > RATES[i - 1].from, 'daty rosnąco');
  const ext = C.buildRates([{ od: '2026-11-05', procent: 9 }, { od: '2020-01-01', procent: 5 }, { od: 'zła', procent: 1 }, { od: '2026-12-10', procent: 99 }]);
  assert.equal(ext.rates.length, 27);
  assert.equal(ext.rates[26].bp, 900);
  assert.equal(ext.rejected, 3);
});
test('Odsetki dla jednego okresu: 1000 zł × 9,25% × 365 dni = 92,50 zł', () => {
  const it = C.computeInterest(100000, D('2026-03-05'), D('2027-03-04'), RATES);
  assert.equal(it.grosze, 9250);
});
test('Kwota słownie', () => {
  const cases = [
    [1, 'zero złotych 01/100'], [100, 'jeden złoty 00/100'], [200, 'dwa złote 00/100'], [500, 'pięć złotych 00/100'],
    [1200, 'dwanaście złotych 00/100'], [1400, 'czternaście złotych 00/100'], [2200, 'dwadzieścia dwa złote 00/100'],
    [2400, 'dwadzieścia cztery złote 00/100'], [11200, 'sto dwanaście złotych 00/100'],
    [123456, 'jeden tysiąc dwieście trzydzieści cztery złote 56/100'], [100100, 'jeden tysiąc jeden złotych 00/100'],
    [2500000, 'dwadzieścia pięć tysięcy złotych 00/100'], [22200000, 'dwieście dwadzieścia dwa tysiące złotych 00/100'],
    [11300000, 'sto trzynaście tysięcy złotych 00/100'], [1200000, 'dwanaście tysięcy złotych 00/100'],
    [100000000, 'jeden milion złotych 00/100'], [120000000, 'jeden milion dwieście tysięcy złotych 00/100'],
    [200000000, 'dwa miliony złotych 00/100'], [500000000, 'pięć milionów złotych 00/100'],
    [12345678900, 'sto dwadzieścia trzy miliony czterysta pięćdziesiąt sześć tysięcy siedemset osiemdziesiąt dziewięć złotych 00/100'],
    [198729, 'jeden tysiąc dziewięćset osiemdziesiąt siedem złotych 29/100']
  ];
  for (const [g, w] of cases) assert.equal(C.amountInWords(g), w, `kwota ${g}`);
});
test('IBAN / NRB i PESEL', () => {
  assert.equal(C.normalizeIBAN('PL61 1090 1014 0000 0712 1981 2874'), 'PL61109010140000071219812874');
  assert.equal(C.normalizeIBAN('61109010140000071219812874'), 'PL61109010140000071219812874');
  assert.equal(C.normalizeIBAN('61-1090-1014-0000-0712-1981-2874'), 'PL61109010140000071219812874');
  assert.equal(C.normalizeIBAN('PL61109010140000071219812875'), null);
  assert.equal(C.normalizeIBAN('PL6110901014000007121981287'), null);
  assert.equal(C.normalizeIBAN('<script>'), null);
  assert.equal(C.formatIBAN('PL61109010140000071219812874'), 'PL61 1090 1014 0000 0712 1981 2874');
  assert.equal(C.validPESEL('44051401359'), true);
  assert.equal(C.validPESEL('44051401358'), false);
  assert.equal(C.validPESEL('4405140135'), false);
});
test('cleanText usuwa znaki sterujące i nadpisanie kierunku tekstu', () => {
  assert.equal(C.cleanText('Jan\u202eKowalski\u0000\n  ', 100), 'Jan Kowalski');
  assert.equal(C.cleanText('a'.repeat(300), 10), 'aaaaaaaaaa');
  assert.equal(C.cleanText(null, 10), '');
  assert.equal(C.slug('Bank Polska Kasa Opieki S.A.'), 'Bank-Polska-Kasa-Opieki-S-A');
  assert.equal(C.slug('Żółć'), 'Zolc');
  assert.equal(C.slug('../../'), 'kredytodawca');
});

console.log(`Testy: ${passed} OK, ${failed} błędów.`);
process.exit(failed ? 1 : 0);
