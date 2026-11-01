// Wspólne funkcje dla build.mjs i check.mjs. Tylko moduły wbudowane Node.js – zero zależności.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PUBLIC = path.join(ROOT, 'public');
export const INDEX = path.join(PUBLIC, 'index.html');
export const HEADERS = path.join(PUBLIC, '_headers');

export const STYLE_RE = /(<style id="app-css">)([\s\S]*?)(<\/style>)/;
export const SCRIPT_RE = /(<script id="app-js">)([\s\S]*?)(<\/script>)/;
export const CSP_RE = /(<meta http-equiv="Content-Security-Policy" content=")([^"]*)(">)/;
// Linia CSP w bloku /* pliku _headers – ta sama polityka co w <meta> + frame-ancestors (aktualizowana przez build).
export const HEADER_CSP_RE = /^(  Content-Security-Policy: )(.*)$/m;
export const VENDOR_RE = /\{ url: '(vendor\/[A-Za-z0-9._-]+)', sri: '([^']*)' \}/g;

export function sha(alg, data) {
  return createHash(alg).update(data).digest('base64');
}

export function inlineHashes(html) {
  const style = STYLE_RE.exec(html);
  const script = SCRIPT_RE.exec(html);
  if (!style || !script) throw new Error('Brak bloku <style id="app-css"> lub <script id="app-js"> w index.html');
  return {
    style: `'sha256-${sha('sha256', style[2])}'`,
    script: `'sha256-${sha('sha256', script[2])}'`
  };
}

export function buildCsp(h) {
  return [
    "default-src 'none'",
    `script-src 'self' ${h.script}`,
    `style-src ${h.style}`,
    "img-src 'self'",
    "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
    'upgrade-insecure-requests',
    'trusted-types kzp',
    "require-trusted-types-for 'script'"
  ].join('; ');
}

export function headerCsp(h) {
  return buildCsp(h) + "; frame-ancestors 'none'";
}

export function vendorSri(file) {
  return 'sha384-' + sha('sha384', readFileSync(path.join(PUBLIC, file)));
}

// Wyciąga moduł obliczeń (blok CALC) z index.html i uruchamia go w izolowanym kontekście.
export function loadCalc(html) {
  const m = /\/\* CALC:BEGIN \*\/([\s\S]*?)\/\* CALC:END \*\//.exec(html);
  if (!m) throw new Error('Brak bloku CALC w index.html');
  const ctx = vm.createContext({});
  vm.runInContext(m[1] + '\nthis.Calc = Calc;', ctx);
  return ctx.Calc;
}
