# Kalkulator Zwrotu Prowizji Bankowej (TSUE C-383/18) – metoda dzienna + generator reklamacji PDF

**🇵🇱 Polski** · [🇬🇧 English below](#-english)

Prywatna aplikacja internetowa (jedna strona), która bezpłatnie oblicza **co do dnia**, ile bank musi oddać prowizji i innych kosztów pobranych z góry po **wcześniejszej spłacie lub konsolidacji kredytu**, dolicza **odsetki ustawowe za opóźnienie** i tworzy gotową **reklamację z wezwaniem do zapłaty w PDF (A4)**, zaadresowaną do siedziby banku (9,99 zł, BLIK – płatność weryfikowana na serwerze).

## Funkcje

- Metoda liniowa co do dnia: dni pierwotne, wykorzystane i skrócone; zaokrąglenie do grosza; odliczenie kwoty już zwróconej przez bank.
- Odsetki ustawowe za opóźnienie liczone okresami według historycznej tabeli stóp (od 2008 r. do dziś), od 15. dnia po spłacie (art. 52 ustawy o kredycie konsumenckim).
- Portfel wielu kredytów („wielokrotna konsolidacja”) z sumą zwrotów i odsetek.
- 14 banków z adresami siedzib (zweryfikowane 24.10.2026) + ręczne wpisanie SKOK / innego kredytodawcy.
- PDF: osobne pismo dla każdego banku lub wszystkie w jednym pliku; tabela wyliczeń, kwota słownie, podstawa prawna, IBAN, załącznik z odsetkami.
- Ostrzeżenia: możliwe przedawnienie, limit 255 550 zł, umowy sprzed 18.12.2011 r., sporny zwrot prowizji przy kredycie hipotecznym.
- SEO: dane strukturalne `SoftwareApplication` i `FAQPage` (JSON-LD), widoczne FAQ, Open Graph.
- Paywall Stripe (Payment Link, BLIK) weryfikowany przez Cloudflare Pages Function `functions/api/verify.js`; Regulamin i Polityka prywatności.
- Miejsce na partnera (np. sankcja kredytu darmowego) – bez partnera neutralne pole „Miejsce dla partnera – kontakt”.

## Podstawa prawna (zweryfikowana)

| Przepis | Co wynika |
|---|---|
| art. 49 ust. 1 ustawy z 12.05.2011 r. o kredycie konsumenckim | obniżenie całkowitego kosztu kredytu przy spłacie całości przed terminem (umowy od 18.12.2011 r., do 255 550 zł) |
| wyrok TSUE z 11.09.2019 r., C-383/18 (Lexitor) | obniżka obejmuje wszystkie koszty nałożone na konsumenta |
| art. 52 ustawy o kredycie konsumenckim | 14 dni na rozliczenie się z konsumentem po spłacie całości |
| art. 39 ust. 1 ustawy z 23.03.2017 r. o kredycie hipotecznym | umowy od 22.07.2017 r.; zwrot jednorazowej prowizji sporny (TSUE C-555/21 z 9.02.2023 r.) |
| art. 481 § 1 i 2 KC | odsetki ustawowe za opóźnienie = stopa referencyjna NBP + 5,5 p.p. (od 5.03.2026 r.: 9,25%) |
| art. 6–8 ustawy z 5.08.2015 r. o rozpatrywaniu reklamacji przez podmioty rynku finansowego, o Rzeczniku Finansowym i o Funduszu Edukacji Finansowej | 30 dni na odpowiedź (w szczególnie skomplikowanych sprawach do 60), po upływie terminu reklamację uważa się za rozpatrzoną zgodnie z wolą klienta |

> **Uwaga:** 30-dniowy termin i „milczące uznanie” reklamacji w banku wynikają z ustawy o rozpatrywaniu reklamacji przez podmioty rynku finansowego (art. 6–8), a **nie** z art. 7a ustawy o prawach konsumenta (tam termin wynosi 14 dni i stosuje się go, jeżeli przepisy odrębne nie stanowią inaczej).

## Prywatność i bezpieczeństwo

- Wszystkie obliczenia i PDF powstają **lokalnie w przeglądarce**; strona nie wysyła danych formularza, nie ma cookies ani analityki. Do weryfikacji płatności wysyłany jest tylko losowy identyfikator zamówienia i identyfikator sesji Stripe (na własną domenę).
- **Brak zewnętrznych CDN**: biblioteka pdfmake 0.2.23 jest serwowana z tej samej domeny i weryfikowana **SRI (sha384)**; CSS (Tailwind) jest skompilowany i wbudowany.
- **Ścisła CSP** z sumami SHA-256 (bez `unsafe-inline` i `unsafe-eval`), **Trusted Types**, `frame-ancestors 'none'`, HSTS, `nosniff`, `no-referrer`, Permissions-Policy.
- Brak `innerHTML` – cała treść wstawiana jako tekst; dane użytkownika są czyszczone ze znaków sterujących i znaków zmiany kierunku tekstu.
- Adresy z konfiguracji (płatność, partner) muszą być `https://` – inne są ignorowane. Stan „opłacone” istnieje tylko w pamięci strony po odpowiedzi serwera – parametry w adresie ani wpisy w `localStorage` go nie dają.
- Zapis w `localStorage` tylko po zaznaczeniu zgody; przycisk „Usuń wszystkie dane”.

## Struktura

```
public/                  ← to publikujesz (katalog wyjściowy hostingu)
  index.html             ← cała aplikacja (HTML + CSS + JS + JSON-LD), budowana przez scripts/build.mjs
  assets/config.js       ← konfiguracja (cena, link płatności, sprzedawca, partner, stopy)
  vendor/                ← pdfmake 0.2.23 + czcionka Roboto (bez modyfikacji, z npm)
  _headers               ← nagłówki bezpieczeństwa (Cloudflare Pages / Netlify)
  robots.txt, sitemap.xml, favicon.svg, og-image.png
functions/api/verify.js  ← Cloudflare Pages Function: weryfikacja płatności w Stripe
scripts/check.mjs        ← testy i kontrola bezpieczeństwa (bez zależności)
scripts/build.mjs        ← kompilacja CSS + aktualizacja sum CSP/SRI
tests/verify.test.mjs    ← testy functions/api/verify.js (atrapa API Stripe)
tests/e2e.mjs            ← test w przeglądarce (Playwright) + treść PDF + paywall
docs/OWNER-GUIDE.md      ← instrukcja wdrożenia i zarabiania (EN)
```

## Konfiguracja (bez programowania)

Wszystkie ustawienia są w pliku **`public/assets/config.js`** (jego edycja nie wymaga `npm run build`):

```js
window.KZP_CONFIG = Object.freeze({
  price: 9.99,                                   // cena PDF w zł (= EXPECTED_AMOUNT 999 gr)
  paymentUrl: 'https://buy.stripe.com/…',        // Stripe Payment Link (pusty = sprzedaż wyłączona)
  verifyEndpoint: '/api/verify',                 // functions/api/verify.js
  seller: { name: '…', address: '…', email: 'kontakt@twojadomena.pl', nip: '' },
  partner: { enabled: true, label: 'Reklama', title: '…', text: '…', cta: '…', url: 'https://partner.pl/…' },
  ratesVerified: '2026-11-30',
  extraRates: [ { od: '2026-11-05', procent: 9.00 } ]
});
```

- **Nigdy nie wpisuj tu kluczy Stripe** – plik jest publiczny.
- `seller` – dane sprzedawcy wyświetlane w Regulaminie, Polityce prywatności i stopce.
- `partner` – bez włączonego partnera (`enabled: true` + adres `https://`) wyświetla się neutralne pole „Miejsce dla partnera – kontakt”.
- `extraRates` – dopisz nową stopę odsetek za opóźnienie, gdy NBP zmieni stopę referencyjną (stopa referencyjna + 5,5). Przykład powyżej jest tylko ilustracją formatu – wpisuj wyłącznie rzeczywiste zmiany.
- `ratesVerified` – data, w której ostatnio sprawdziłeś stopy (wyświetlana na stronie).
- Zmieniając domenę, podmień `https://kalkulator-zwrotu-prowizji.pl` w `public/index.html`, `public/robots.txt` i `public/sitemap.xml`.

## Płatność (paywall weryfikowany na serwerze)

Kalkulator, wyliczenia i portfel są bezpłatne. Płatna jest tylko reklamacja PDF (**9,99 zł**, BLIK, jednorazowo za wszystkie banki z portfela):

1. „Pobierz reklamację PDF” → okno zamówienia z dwiema obowiązkowymi zgodami (Regulamin + art. 38 ust. 1 pkt 13 ustawy o prawach konsumenta); podgląd pisma jest zablokowany (szare paski, bez treści).
2. Strona sprawdza `GET /api/verify?ping=1`; jeśli serwer nie jest gotowy, wyświetla „Sprzedaż chwilowo niedostępna – nie pobraliśmy żadnych środków”.
3. Dane formularza trafiają do `sessionStorage` tej karty, losowy identyfikator zamówienia do `localStorage`, a klient przechodzi do Payment Linku z `client_reference_id`.
4. Po powrocie (`?platnosc=sukces&session_id=…`) strona pyta `/api/verify` (do 3 ponowień co 2 s); serwer sprawdza w Stripe link płatności, kwotę, walutę PLN, `client_reference_id`, tryb live i wiek płatności. Dopiero wtedy PDF jest generowany i pobierany automatycznie.

Tryb demonstracyjny (PDF bez opłaty) działa wyłącznie na `localhost` / `127.0.0.1` przy pustym `paymentUrl`.

## Wdrożenie – Cloudflare Pages

1. Cloudflare Pages → połącz repozytorium → **Build command: (puste)** → **Build output directory:** `public`. Katalog `functions/` (w głównym katalogu repozytorium) Cloudflare wdraża automatycznie jako `/api/verify`. Zbudowany `public/index.html` jest w repozytorium – przed commitem uruchom `npm run build`.
2. Settings → Variables and Secrets (typ **Secret**, środowisko Production):
   - `STRIPE_SECRET_KEY=rk_live_…` – **klucz ograniczony** z jednym uprawnieniem „Checkout Sessions: Read” (pełny klucz `sk_…` jest odrzucany),
   - `PAYMENT_LINK_ID=plink_…` – identyfikator Payment Linku,
   - `EXPECTED_AMOUNT=999` – cena w groszach (9,99 zł),
   - opcjonalnie `MAX_AGE_DAYS=30`; `ALLOW_TEST_MODE=true` tylko na czas testów.
3. Stripe → Payment Links → nowy link: produkt „Reklamacja PDF – zwrot prowizji”, cena **9,99 PLN**, metody płatności: **tylko BLIK**, po płatności: przekierowanie na
   `https://DOMENA/?platnosc=sukces&session_id={CHECKOUT_SESSION_ID}`.
4. Wpisz adres linku (`https://buy.stripe.com/…`) w `paymentUrl` w `public/assets/config.js` i uzupełnij `seller`.
5. Sprawdź: `https://DOMENA/api/verify?ping=1` musi zwracać `{"ready":true}`.

Szczegóły: [docs/OWNER-GUIDE.md](docs/OWNER-GUIDE.md).

## Dla programistów

```bash
npm install          # Tailwind (tylko do budowania CSS)
npm run build        # kompiluje CSS, aktualizuje SRI i sumy CSP (index.html + _headers), uruchamia testy
npm test             # testy obliczeń + kontrola bezpieczeństwa + testy functions/api/verify.js
npm run e2e          # test w Chromium (Playwright, pdftotext): kalkulator, PDF, paywall z atrapą /api/verify
```

Po każdej zmianie kodu JavaScript lub klas CSS w `index.html` uruchom `npm run build` – inaczej przeglądarka zablokuje skrypt (CSP).

## Licencje

Kod aplikacji: wszelkie prawa zastrzeżone. pdfmake – MIT; czcionka Roboto – SIL Open Font License 1.1 (zob. `public/vendor/THIRD-PARTY-LICENSES.txt`).

**Zastrzeżenie:** narzędzie ma charakter informacyjny i nie stanowi porady prawnej.

---

## 🇬🇧 English

A privacy-first single-page web app (in Polish, for Polish borrowers) that calculates, **to the exact day**, the refund of upfront commissions and other non-interest costs owed after **early repayment or consolidation of a loan** (Polish Consumer Credit Act art. 49, CJEU judgment C-383/18 *Lexitor*), adds **statutory late-payment interest**, and generates a formal **A4 PDF complaint and payment demand** addressed to the bank's registered office. The calculator is free; the PDF costs 9.99 PLN (Stripe Payment Link, BLIK), verified server-side by a Cloudflare Pages Function (`functions/api/verify.js`).

**Highlights**

- Daily linear proration (`refund = costs × shortened days ÷ original days`), exact integer arithmetic in grosze, half-up rounding.
- Statutory late interest computed per rate period from a verified historical table (2008 → 9.25% since 5 March 2026), starting on day 15 after repayment (art. 52 of the Consumer Credit Act: 14-day settlement duty).
- Multi-loan portfolio, 14 banks with verified head-office addresses (plus manual entry for SKOK/other lenders), one PDF per bank or a combined PDF.
- Warnings for possible limitation (6 years, end of calendar year), the PLN 255,550 cap, pre-18.12.2011 contracts and the contested mortgage commission refund (CJEU C-555/21).
- `SoftwareApplication` + `FAQPage` JSON-LD, Open Graph image.

**Legal correction vs. the original brief:** the 30-day reply deadline with deemed acceptance for banks comes from arts. 6–8 of the 2015 Act on complaint handling by financial-market entities — not from art. 7a of the Consumer Rights Act (that one is 14 days and applies only where no special rule exists).

**Security model:** no form data leaves the browser (payment verification sends only a random order id and the Stripe session id to the site's own `/api/verify`); no third-party requests (pdfmake is self-hosted and SRI-pinned, Tailwind CSS is precompiled and inlined); strict hash-based CSP without `unsafe-inline`/`unsafe-eval`; Trusted Types; anti-framing (header + JS); HSTS; no `innerHTML`; input sanitisation (control and bidi-override characters); https-only config URLs; opt-in local storage with a one-click wipe.

**Deploy:** Cloudflare Pages, build command empty (built output is committed), output directory `public`; secrets `STRIPE_SECRET_KEY=rk_live_…`, `PAYMENT_LINK_ID=plink_…`, `EXPECTED_AMOUNT=999`; Payment Link BLIK-only redirecting to `https://DOMAIN/?platnosc=sukces&session_id={CHECKOUT_SESSION_ID}`. Full owner guide (deployment, domain, monetisation, account security): [docs/OWNER-GUIDE.md](docs/OWNER-GUIDE.md).

**Develop:** `npm install && npm run build` (compiles CSS, refreshes SRI/CSP hashes, runs tests); `npm run e2e` runs a real-browser test that downloads the PDF and checks its text.

*Not legal advice.*
