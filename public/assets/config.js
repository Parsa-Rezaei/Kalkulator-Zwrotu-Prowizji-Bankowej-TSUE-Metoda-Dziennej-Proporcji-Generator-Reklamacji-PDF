/* =====================================================================
   KONFIGURACJA SERWISU – jedyny plik, który edytujesz przed startem.
   Zmiana tego pliku NIE wymaga uruchamiania „npm run build”.
   NIGDY nie wpisuj tutaj kluczy Stripe (sk_…, rk_…) ani haseł –
   ten plik jest publiczny. Klucze trzymasz wyłącznie w ustawieniach
   Cloudflare Pages (Variables and Secrets).
   ===================================================================== */
window.KZP_CONFIG = Object.freeze({
  // Cena reklamacji PDF w zł – musi być równa cenie produktu w Stripe
  // i zmiennej EXPECTED_AMOUNT w Cloudflare (w groszach: 9.99 zł = 999).
  price: 9.99,

  // Link płatności Stripe (Payment Link, tylko BLIK), np. 'https://buy.stripe.com/abc123'.
  // Pusty = sprzedaż wyłączona (na komputerze lokalnym działa tryb demonstracyjny).
  paymentUrl: '',

  // Weryfikacja płatności po stronie serwera (functions/api/verify.js na Cloudflare Pages).
  verifyEndpoint: '/api/verify',

  // Dane sprzedawcy do regulaminu, polityki prywatności i stopki.
  seller: Object.freeze({
    name: '[imię i nazwisko / firma]',
    address: '[adres]',
    email: '[e-mail kontaktowy]',
    nip: ''
  }),

  // Slot partnera (np. kancelaria – sankcja kredytu darmowego). Tylko adresy https://.
  // Bez włączonego partnera wyświetla się neutralne „Miejsce dla partnera – kontakt”.
  partner: Object.freeze({
    enabled: false,
    label: 'Reklama',
    title: '',
    text: '',
    cta: 'Sprawdź',
    url: ''
  }),

  // Data ostatniego sprawdzenia stóp procentowych (RRRR-MM-DD), wyświetlana na stronie.
  ratesVerified: '',

  // Nowa stopa odsetek ustawowych za opóźnienie po zmianie stopy referencyjnej NBP
  // (stopa referencyjna + 5,5), np. [{ od: '2026-11-05', procent: 9.00 }].
  // Wpisuj wyłącznie rzeczywiste zmiany.
  extraRates: []
});
