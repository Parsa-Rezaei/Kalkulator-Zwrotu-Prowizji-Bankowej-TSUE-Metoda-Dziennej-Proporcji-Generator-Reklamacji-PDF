// Generuje public/og-image.png (1200×630) – obrazek podglądu linku w mediach społecznościowych.
// Wymaga Playwright z przeglądarką Chromium: node scripts/make-og.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { PUBLIC } from './lib.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');

const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8"><style>
body{margin:0;width:1200px;height:630px;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;background:linear-gradient(135deg,#065f46,#022c22);color:#fff;display:flex;flex-direction:column;justify-content:center;padding:0 80px;box-sizing:border-box}
.k{font-size:26px;color:#a7f3d0;font-weight:600}.t{font-size:64px;font-weight:800;line-height:1.08;margin:18px 0 22px}
.s{font-size:30px;color:#ecfdf5}.b{display:flex;gap:14px;margin-top:36px}.b span{background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.25);border-radius:999px;padding:10px 22px;font-size:24px;font-weight:600}
.f{position:absolute;right:80px;top:70px;font-size:110px;font-weight:800;color:#fbbf24}
</style></head><body><div class="f">zł</div><div class="k">Wyrok TSUE C-383/18 (Lexitor) · art. 49 ustawy o kredycie konsumenckim</div>
<div class="t">Kalkulator zwrotu prowizji<br>za wcześniejszą spłatę kredytu</div>
<div class="s">Metoda co do dnia · odsetki ustawowe · reklamacja PDF do banku</div>
<div class="b"><span>Za darmo</span><span>Bez rejestracji</span><span>Dane zostają u Ciebie</span></div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.screenshot({ path: path.join(PUBLIC, 'og-image.png') });
await browser.close();
console.log('OK: public/og-image.png');
