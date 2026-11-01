// Buduje CSS (Tailwind) i aktualizuje sumy kontrolne w public/index.html oraz CSP w public/_headers.
// Użycie: npm install && npm run build
// Uruchamiaj po każdej zmianie kodu JavaScript, klas CSS lub plików w public/vendor.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { ROOT, INDEX, HEADERS, STYLE_RE, CSP_RE, HEADER_CSP_RE, VENDOR_RE, inlineHashes, buildCsp, headerCsp, vendorSri } from './lib.mjs';

let html = readFileSync(INDEX, 'utf8');

// 1. Tailwind: skanujemy index.html bez dotychczasowego CSS, żeby wynik był powtarzalny.
const tmp = path.join(ROOT, '.build');
mkdirSync(tmp, { recursive: true });
const contentFile = path.join(tmp, 'content.html');
writeFileSync(contentFile, html.replace(STYLE_RE, '$1$3'));
const configFile = path.join(tmp, 'tailwind.config.cjs');
writeFileSync(configFile, `module.exports = { content: [${JSON.stringify(contentFile)}], theme: { extend: {} }, plugins: [] };\n`);
const outFile = path.join(tmp, 'app.css');
execFileSync(process.execPath, [
  path.join(ROOT, 'node_modules', 'tailwindcss', 'lib', 'cli.js'),
  '-c', configFile, '-i', path.join(ROOT, 'src', 'tailwind.css'), '-o', outFile, '--minify'
], { stdio: 'inherit' });
const css = readFileSync(outFile, 'utf8').trim();
if (css.includes('</style')) throw new Error('Niedozwolona sekwencja w CSS');
html = html.replace(STYLE_RE, (_, a, _b, c) => a + css + c);

// 2. SRI bibliotek z public/vendor.
html = html.replace(VENDOR_RE, (_, file) => `{ url: '${file}', sri: '${vendorSri(file)}' }`);

// 3. CSP z sumami SHA-256 skryptu i stylu wbudowanych w stronę.
html = html.replace(CSP_RE, (_, a, _b, c) => a + buildCsp(inlineHashes(html)) + c);

writeFileSync(INDEX, html);

// 4. Ta sama CSP (z frame-ancestors) jako nagłówek HTTP w public/_headers.
const headers = readFileSync(HEADERS, 'utf8');
if (!HEADER_CSP_RE.test(headers)) throw new Error('Brak linii Content-Security-Policy w public/_headers');
writeFileSync(HEADERS, headers.replace(HEADER_CSP_RE, (_, a) => a + headerCsp(inlineHashes(html))));
rmSync(tmp, { recursive: true, force: true });
console.log(`OK: index.html zaktualizowany (CSS ${css.length} B).`);
