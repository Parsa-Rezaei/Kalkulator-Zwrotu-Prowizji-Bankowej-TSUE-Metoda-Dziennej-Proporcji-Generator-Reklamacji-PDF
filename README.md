# Kalkulator Zwrotu Prowizji Bankowej (TSUE C-383/18) – metoda dzienna + generator reklamacji PDF

**🇵🇱 Polski** · [🇬🇧 English below](#-english)

Bezpłatna, prywatna aplikacja internetowa (jedna strona), która oblicza **co do dnia**, ile bank musi oddać prowizji i innych kosztów pobranych z góry po **wcześniejszej spłacie lub konsolidacji kredytu**, dolicza **odsetki ustawowe za opóźnienie** i tworzy gotową **reklamację z wezwaniem do zapłaty w PDF (A4)**, zaadresowaną do siedziby banku.

## Funkcje

- Metoda liniowa co do dnia: dni pierwotne, wykorzystane i skrócone; zaokrąglenie do grosza; odliczenie kwoty już zwróconej przez bank.
- Odsetki ustawowe za opóźnienie liczone okresami według historycznej tabeli stóp (od 2008 r. do dziś), od 15. dnia po spłacie (art. 52 ustawy o kredycie konsumenckim).
- Portfel wielu kredytów („wielokrotna konsolidacja”) z sumą zwrotów i odsetek.
- 14 banków z adresami siedzib (zweryfikowane 24.10.2026) + ręczne wpisanie SKOK / innego kredytodawcy.
- PDF: osobne pismo dla każdego banku lub wszystkie w jednym pliku; tabela wyliczeń, kwota słownie, podstawa prawna, IBAN, załącznik z odsetkami.
- Ostrzeżenia: możliwe przedawnienie, limit 255 550 zł, umowy sprzed 18.12.2011 r., sporny zwrot prowizji przy kredycie hipotecznym.
- SEO: dane strukturalne `SoftwareApplication` i `FAQPage` (JSON-LD), widoczne FAQ, Open Graph.
- Miejsce na wsparcie projektu (BuyCoffee.to – BLIK) i na partnera (sankcja kredytu darmowego).

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

- Wszystkie obliczenia i PDF powstają **lokalnie w przeglądarce**; strona nie wysyła danych, nie ma cookies ani analityki.
- **Brak zewnętrznych CDN**: biblioteka pdfmake 0.2.23 jest serwowana z tej samej domeny i weryfikowana **SRI (sha384)**; CSS (Tailwind) jest skompilowany i wbudowany.
- **Ścisła CSP** z sumami SHA-256 (bez `unsafe-inline` i `unsafe-eval`), **Trusted Types**, `frame-ancestors 'none'`, HSTS, `nosniff`, `no-referrer`, Permissions-Policy.
- Brak `innerHTML` – cała treść wstawiana jako tekst; dane użytkownika są czyszczone ze znaków sterujących i znaków zmiany kierunku tekstu.
- Adresy z konfiguracji (wsparcie, partner) muszą być `https://` – inne są ignorowane.
- Zapis w `localStorage` tylko po zaznaczeniu zgody; przycisk „Usuń wszystkie dane”.

## Struktura

```
public/                  ← to publikujesz (katalog wyjściowy hostingu)
  index.html             ← cała aplikacja (HTML + CSS + JS + JSON-LD + konfiguracja)
  vendor/                ← pdfmake 0.2.23 + czcionka Roboto (bez modyfikacji, z npm)
  _headers               ← nagłówki bezpieczeństwa (Cloudflare Pages / Netlify)
  robots.txt, sitemap.xml, favicon.svg, og-image.png
scripts/check.mjs        ← testy i kontrola bezpieczeństwa (bez zależności)
scripts/build.mjs        ← kompilacja CSS + aktualizacja sum CSP/SRI
tests/e2e.mjs            ← test w przeglądarce (Playwright) + sprawdzenie treści PDF
docs/OWNER-GUIDE.md      ← instrukcja wdrożenia i zarabiania (EN)
```

## Konfiguracja (bez programowania)

W `public/index.html` znajdź blok `<script type="application/json" id="app-config">` i uzupełnij:

```json
{
  "buyCoffeeUrl": "https://buycoffee.to/TWOJA-NAZWA",
  "supportCta": "Postaw kawę – BLIK / karta",
  "partner": { "enabled": true, "label": "Reklama", "title": "…", "text": "…", "cta": "…", "url": "https://partner.pl/…" },
  "owner": { "name": "Imię Nazwisko / Firma, adres", "email": "kontakt@twojadomena.pl" },
  "ratesVerified": "2026-11-30",
  "extraRates": [ { "od": "2026-11-05", "procent": 9.00 } ]
}
```

- Ten blok **nie jest wykonywany jako skrypt**, więc jego edycja nie psuje CSP.
- `extraRates` – dopisz nową stopę odsetek za opóźnienie, gdy NBP zmieni stopę referencyjną (stopa referencyjna + 5,5). Przykład powyżej jest tylko ilustracją formatu – wpisuj wyłącznie rzeczywiste zmiany.
- `ratesVerified` – data, w której ostatnio sprawdziłeś stopy (wyświetlana na stronie).
- Zmieniając domenę, podmień `https://kalkulator-zwrotu-prowizji.pl` w `public/index.html`, `public/robots.txt` i `public/sitemap.xml`.

## Wdrożenie (skrót)

Cloudflare Pages → połącz repozytorium → **Build command:** `node scripts/check.mjs` → **Build output directory:** `public`. Jeśli testy nie przejdą, nowa wersja nie zostanie opublikowana. Szczegóły: [docs/OWNER-GUIDE.md](docs/OWNER-GUIDE.md).

## Dla programistów

```bash
npm install          # Tailwind (tylko do budowania CSS)
npm run build        # kompiluje CSS, aktualizuje SRI i sumy CSP, uruchamia testy
npm test             # testy obliczeń + kontrola bezpieczeństwa (bez zależności)
npm run e2e          # test w Chromium (wymaga Playwright i pdftotext)
```

Po każdej zmianie kodu JavaScript lub klas CSS w `index.html` uruchom `npm run build` – inaczej przeglądarka zablokuje skrypt (CSP).

## Licencje

Kod aplikacji: wszelkie prawa zastrzeżone. pdfmake – MIT; czcionka Roboto – SIL Open Font License 1.1 (zob. `public/vendor/THIRD-PARTY-LICENSES.txt`).

**Zastrzeżenie:** narzędzie ma charakter informacyjny i nie stanowi porady prawnej.

---

## 🇬🇧 English

A free, privacy-first single-page web app (in Polish, for Polish borrowers) that calculates, **to the exact day**, the refund of upfront commissions and other non-interest costs owed after **early repayment or consolidation of a loan** (Polish Consumer Credit Act art. 49, CJEU judgment C-383/18 *Lexitor*), adds **statutory late-payment interest**, and generates a formal **A4 PDF complaint and payment demand** addressed to the bank's registered office.

**Highlights**

- Daily linear proration (`refund = costs × shortened days ÷ original days`), exact integer arithmetic in grosze, half-up rounding.
- Statutory late interest computed per rate period from a verified historical table (2008 → 9.25% since 5 March 2026), starting on day 15 after repayment (art. 52 of the Consumer Credit Act: 14-day settlement duty).
- Multi-loan portfolio, 14 banks with verified head-office addresses (plus manual entry for SKOK/other lenders), one PDF per bank or a combined PDF.
- Warnings for possible limitation (6 years, end of calendar year), the PLN 255,550 cap, pre-18.12.2011 contracts and the contested mortgage commission refund (CJEU C-555/21).
- `SoftwareApplication` + `FAQPage` JSON-LD, Open Graph image.

**Legal correction vs. the original brief:** the 30-day reply deadline with deemed acceptance for banks comes from arts. 6–8 of the 2015 Act on complaint handling by financial-market entities — not from art. 7a of the Consumer Rights Act (that one is 14 days and applies only where no special rule exists).

**Security model:** no data leaves the browser; no third-party requests (pdfmake is self-hosted and SRI-pinned, Tailwind CSS is precompiled and inlined); strict hash-based CSP without `unsafe-inline`/`unsafe-eval`; Trusted Types; anti-framing (header + JS); HSTS; no `innerHTML`; input sanitisation (control and bidi-override characters); https-only config URLs; opt-in local storage with a one-click wipe.

**Deploy:** Cloudflare Pages, build command `node scripts/check.mjs`, output directory `public`. Full owner guide (deployment, domain, monetisation, account security): [docs/OWNER-GUIDE.md](docs/OWNER-GUIDE.md).

**Develop:** `npm install && npm run build` (compiles CSS, refreshes SRI/CSP hashes, runs tests); `npm run e2e` runs a real-browser test that downloads the PDF and checks its text.

*Not legal advice.*
