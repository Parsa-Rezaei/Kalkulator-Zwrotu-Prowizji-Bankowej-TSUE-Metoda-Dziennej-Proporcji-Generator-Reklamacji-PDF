# Owner guide – deploy, secure, and earn from the calculator

Plain-language, step-by-step. Do the steps in order. Nothing here requires programming.

---

## 0. What you have

- A finished website in the `public/` folder. The whole app is `public/index.html`.
- It runs 100% in the visitor's browser. You store no customer data, so there is no customer database to leak.
- Built-in money slots: a "support" button (BuyCoffee.to, which accepts BLIK) shown when the PDF is downloaded, and an advertising card for a partner (sankcja kredytu darmowego). Both are switched **off** until you fill in your own links.
- A safety check (`scripts/check.mjs`) that the hosting runs before every publish. If someone breaks the page or the security settings, the new version does not go live.

### What I changed from your brief, and why

1. **30-day rule:** for banks it comes from **arts. 6–8 of the Act of 5 August 2015 on complaint handling by financial-market entities**, not from art. 7a of the Consumer Rights Act. Art. 7a gives 14 days and applies only when no special law exists. The PDF cites the correct law. A wrong citation would hurt your users and your reputation.
2. **Interest rate:** statutory late interest is not a flat 9.25%. It changes with the NBP reference rate. The app uses the full verified history (9.25% since 5 March 2026) and calculates each period separately.
3. **Mortgages:** art. 39 has no 14-day rule, and refund of a one-off commission is legally disputed (CJEU C-555/21, 9 Feb 2023). The app still calculates it, warns the user, and for mortgages claims interest only from the day after the payment deadline in the letter.
4. **PKO BP address:** the head office moved on 27 June 2025 to ul. Świętokrzyska 36, 00-116 Warszawa. **Credit Agricole** is at ul. Legnicka 48 bud. C-D, 54-202 Wrocław. **Citi Handlowy's** retail business moved to VeloBank in June 2026, so letters to Citi automatically add "Do wiadomości: VeloBank S.A.".
5. **No hard paywall (9.99 zł).** On a static site, any paywall written in browser code can be switched off by anyone in about a minute using browser developer tools. A fake paywall also creates legal duties (terms of sale, receipts, consumer withdrawal rules) and refund disputes. So the PDF is free, and the download window asks for **voluntary** support through BuyCoffee.to. BuyCoffee.to handles the payment, so card or BLIK data never touches your site. Section 9 explains the paid option if you want it later.
6. **No CDNs.** Tailwind is precompiled into the page and pdfmake is hosted on your own domain with an integrity hash. No third party can inject code into your site, and visitors' IP addresses are not sent to CDN companies.

---

## 1. Secure your accounts first

Your biggest real risk is someone taking over an account and swapping your links or code, not a bug in the page. Do this once, today:

1. **Email account** (the one you use for GitHub, Cloudflare, the domain registrar and BuyCoffee): turn on 2-step verification, ideally with a passkey or an authenticator app, not SMS. Whoever controls this inbox can reset every other password.
2. **GitHub:** Settings → Password and authentication → enable **two-factor authentication** and add a **passkey**. Save the recovery codes offline.
3. **Cloudflare** (after you create the account): My Profile → Authentication → enable 2FA.
4. **Domain registrar:** enable 2FA and turn on the **transfer lock** (often called "blokada transferu" or "registrar lock").
5. **BuyCoffee.to:** use a unique, long password from a password manager, and turn on 2FA if the service offers it.
6. Use a **password manager** (for example Bitwarden or 1Password). Never reuse passwords.
7. Never paste "tracking codes", "chat widgets" or scripts from anyone into `index.html`. The page's security policy blocks them, and they are the most common way sites get compromised.
8. Never give anyone your GitHub, Cloudflare or registrar login. If someone needs to help, invite them with their own account and remove them afterwards.

---

## 2. GitHub: rename the repository, set the description, make it private

I can't change repository settings from this session (my GitHub tools have no permission for that), so do it yourself:

1. Open the repository on github.com → **Settings** (top tab).
2. **Repository name:** change it to `kalkulator-zwrotu-prowizji` → **Rename**. GitHub redirects the old address automatically.
3. **Default branch:** my work is on the branch `claude/serene-babbage-ssxk60`. Because the repository was empty, GitHub most likely made it the default branch. In **Settings → General → Default branch**, click the pencil/rename icon and rename it to `main`. If GitHub instead shows an open pull request, merge it into `main`.
4. Go back to the repository's main page. On the right, next to **About**, click the ⚙️ gear and fill in:
   - **Description:** `Kalkulator zwrotu prowizji za wcześniejszą spłatę i konsolidację kredytu (TSUE C-383/18, art. 49 u.k.k.) – metoda co do dnia, odsetki ustawowe, reklamacja PDF. Dane zostają w przeglądarce.`
   - **Website:** your domain, after step 3, for example `https://kalkulator-zwrotu-prowizji.pl`
   - **Topics:** `kalkulator`, `kredyt`, `zwrot-prowizji`, `tsue`, `wczesniejsza-splata`, `konsolidacja`, `reklamacja`, `pdf`, `polska`, `privacy-first`
5. **Make it private (recommended):** Settings → General → scroll to **Danger Zone** → **Change visibility** → **Make private**. Competitors then can't copy your code with one click. Cloudflare can still deploy from a private repository.
6. **Protect the main branch:** Settings → Branches → **Add branch protection rule** (or **Rulesets**) for `main` → tick "Require a pull request before merging" if you will work with other people.

---

## 3. Choose and buy a domain

**Suggested site name (brand):** *Kalkulator Zwrotu Prowizji*

**Suggested domains** (I can't check availability from here, so check each one):

1. `kalkulator-zwrotu-prowizji.pl` – already written into the files
2. `zwrotprowizjikalkulator.pl`
3. `mojzwrotprowizji.pl`
4. `oddajprowizje.pl`

Avoid putting "lexitor" in the domain. Lexitor is the name of a real company, so using it could create a trademark problem.

How to buy:

1. Search the name at a Polish registrar such as **OVHcloud**, **nazwa.pl** or **home.pl**, or check it in the WHOIS lookup on **dns.pl**.
2. Before you pay, compare the **renewal price** (not only the cheap first year).
3. Buy it, then turn on 2FA and the transfer lock (step 1.4).

**If you buy a domain other than `kalkulator-zwrotu-prowizji.pl`,** replace the address in 3 files. On github.com, open each file → click the ✏️ pencil → edit → **Commit changes**:

- `public/index.html` – 4 places: `canonical`, `og:url`, `og:image`, and the `"url"` line in the JSON-LD block. Use Ctrl+F to find `kalkulator-zwrotu-prowizji.pl`.
- `public/robots.txt` – the `Sitemap:` line
- `public/sitemap.xml` – the `<loc>` line

These edits are safe: they don't touch the protected script. The safety check also confirms that all 6 addresses match. If you miss one, it stops the publish and names the file.

---

## 4. Publish on Cloudflare Pages (free)

Cloudflare is recommended because it applies the security headers from `public/_headers` (anti-clickjacking, HSTS and more). GitHub Pages cannot set these headers.

1. Create an account at **dash.cloudflare.com** and enable 2FA (step 1.3).
2. In the left menu open **Workers & Pages** → **Create** → **Pages** tab → **Connect to Git** (Import an existing Git repository).
3. Authorise the **Cloudflare GitHub app**. Give it access **only** to this repository.
4. Select the repository → **Begin setup**, then set:
   - **Project name:** `kalkulator-zwrotu-prowizji` (gives you a test address `kalkulator-zwrotu-prowizji.pages.dev`)
   - **Production branch:** `main`
   - **Framework preset:** `None`
   - **Build command:** `node scripts/check.mjs`
   - **Build output directory:** `public`
5. Click **Save and Deploy** and wait about 1 minute. The log should end with `Testy: 20 OK, 0 błędów.`
6. Open the `…pages.dev` address and test it: click **Wypełnij przykładem**, add the loan, fill in your details, and download the PDF.
7. **Connect your domain:** in the project open **Custom domains** → **Set up a custom domain** → type your domain. If the domain is not yet on Cloudflare, Cloudflare tells you to **add the site** (choose the **Free** plan) and shows you **2 nameservers**. Log in to your registrar → the domain's DNS / nameserver ("serwery DNS") settings → replace the existing nameservers with Cloudflare's two → save. This can take from a few minutes up to 24–48 hours. HTTPS is set up automatically.
8. Optional: add `www.` as a second custom domain too, so both addresses work.
9. **Check the security headers:** enter your address at **securityheaders.com** and at **developer.mozilla.org/observatory**. You should get top grades.

The `pages.dev` copy is automatically marked `noindex`, so Google indexes only your real domain.

> Cloudflare renames menus from time to time. If you don't see "Pages", look for an option to create an application by importing a Git repository with static files. Use the same build command and output folder.

From now on, **every change you commit on GitHub goes live automatically within about a minute**, but only if the safety check passes.

---

## 5. Turn on the money slots

All settings live in one block in `public/index.html`. On GitHub open the file → ✏️ → press Ctrl+F and search for `app-config`:

```json
{
  "buyCoffeeUrl": "",
  "supportCta": "Postaw kawę – BLIK / karta",
  "partner": { "enabled": false, "label": "Reklama", "title": "…", "text": "…", "cta": "…", "url": "" },
  "owner": { "name": "", "email": "" },
  "ratesVerified": "",
  "extraRates": []
}
```

Rules: keep the quotes and commas exactly as they are. Links must start with `https://`; anything else is ignored on purpose. If you break the JSON (for example a missing quote), the safety check stops the publish, so the live site is never broken.

### 5a. Voluntary support – BuyCoffee.to (BLIK, cards, transfers)

1. Create a profile at **buycoffee.to** and fill in the payout details (your bank account). Read their current fee table first; they take a commission on each payment.
2. Copy your profile link, for example `https://buycoffee.to/kalkulatorprowizji`.
3. Paste it into `"buyCoffeeUrl": "https://buycoffee.to/kalkulatorprowizji"` → **Commit changes**.
4. After about a minute, the download window shows the yellow **"Postaw kawę – BLIK / karta"** button.

### 5b. Partner advert – SKD / law-firm leads (usually your biggest income)

1. Find companies that handle **sankcja kredytu darmowego (SKD)** and Lexitor claims and that run an **affiliate or partner programme** (they pay per lead or per signed client). Search for terms like "program partnerski SKD" or "współpraca afiliacyjna sankcja kredytu darmowego", and contact them directly.
2. Agree in writing on: the commission, how leads are counted, when payment is made, and that they comply with GDPR when handling the people you send.
3. Note: Polish **advocates and legal advisers** have professional ethics rules that can restrict paying for client referrals. Many SKD firms are ordinary companies that buy claims, not law offices. Ask the partner how they are allowed to pay you.
4. They give you a tracking link. Fill in the partner block: `"enabled": true`, your own `title`, `text` and `cta` if you want, and `"url": "https://…their link…"`.
5. Keep `"label": "Reklama"`. Hidden advertising is an unfair market practice under Polish law, and the label protects you. The link automatically gets `rel="sponsored"` for Google.

### 5c. Your legal details (required)

The Polish law on electronic services (ustawa o świadczeniu usług drogą elektroniczną) requires a service provider to publish identifying details and terms of service. The page already contains the terms (Regulamin). Fill in:

```json
"owner": { "name": "Jan Kowalski, ul. Przykładowa 1, 00-001 Warszawa", "email": "kontakt@twojadomena.pl" }
```

Use a dedicated email address, for example a free mailbox or one created through your registrar, not your private address.

---

## 6. Get visitors (SEO and promotion)

1. **Google Search Console** (search.google.com/search-console) → Add property → **Domain** → verify with the DNS TXT record (add it in Cloudflare → DNS). Then **Sitemaps** → submit `sitemap.xml`. Then **URL inspection** → your homepage → **Request indexing**.
2. **Bing Webmaster Tools** → import from Google Search Console (one click).
3. The page already targets searches such as "kalkulator zwrotu prowizji", "zwrot prowizji za wcześniejszą spłatę kredytu", "konsolidacja zwrot prowizji" and "TSUE Lexitor kalkulator". It includes FAQ rich-result data and a social-sharing image.
4. **Promotion ideas** (always honest, never spam):
   - Answer real questions on Polish forums and Facebook groups about loans, consolidation and debt, where links are allowed. Show an example calculation and link the tool.
   - Short videos (TikTok / YouTube Shorts / Reels): "Spłaciłeś kredyt wcześniej? Bank może Ci oddać część prowizji – sprawdź w 2 minuty."
   - Ask finance bloggers to review the free tool. Free tools earn natural links.
   - Urgent angle: loans repaid in 2020 may become time-barred on 31.12.2026 (6-year limitation, end of the calendar year). The calculator already warns about this.
5. Never promise a result ("bank na pewno odda"). Promising outcomes can be treated as a misleading practice.

---

## 7. Keep it correct (about 15 minutes a month)

1. **Interest rates:** after each NBP Monetary Policy Council (RPP) meeting, check whether the **reference rate** changed (nbp.pl). If it did, add a line to `extraRates`, where the percentage = new reference rate + 5.5:
   ```json
   "extraRates": [ { "od": "YYYY-MM-DD", "procent": 9.00 } ]
   ```
   `od` is the date the new rate takes effect. Also set `"ratesVerified": "YYYY-MM-DD"` to the date you checked. Then update the sentence "Od 5 marca 2026 r. wynoszą one 9,25%" in the FAQ, in **both** places in `index.html` (the visible FAQ and the JSON-LD). The safety check verifies that the two copies match.
2. **Bank addresses:** a few times a year, check the head-office addresses on the banks' websites or in the KRS register. To change an address in the built-in list, ask a developer (see step 8), because the list sits inside the protected script.
3. **Law changes:** Poland must implement the new EU consumer credit directive (CCD2, applicable from 20 Nov 2026). As of my research, the new Polish act **had not been passed**. When it passes, have the legal texts reviewed. Contracts signed before it generally stay under the 2011 act.

---

## 8. Changing the code itself (only if needed)

The main script and the styles are protected by hashes. If you change anything inside `<script id="app-js">` or `<style id="app-css">` without rebuilding, the safety check blocks the publish (that is intended). To make code changes, a developer, or Claude Code, runs:

```bash
npm install
npm run build     # recompiles CSS, refreshes hashes, runs 20 tests
npm run e2e       # optional: real-browser test that downloads and reads the PDF
```

and commits the result.

---

## 9. If you later want a real paid download (9.99 zł)

Only consider this once traffic justifies it:

1. Register a business, or stay within the unregistered-activity limit (see step 10), and add terms of sale and receipts.
2. Use a payment provider with BLIK (for example Stripe, Przelewy24 or PayU) together with a small server function that confirms the payment.
3. Be aware: as long as the PDF is generated in the browser, a technical user can bypass the paywall. The only robust paywall generates the PDF on a server, which means the user's data leaves their browser. That breaks the "privacy-first" promise and makes you a personal-data controller under GDPR, with extra obligations.
4. For digital content, the buyer must give explicit consent to delivery before the withdrawal period ends and acknowledge losing the withdrawal right.

The donation + partner model avoids all of this and is the safer choice.

---

## 10. Taxes and legal basics (Poland)

- Money from BuyCoffee and affiliate commissions is **income**.
- **Unregistered activity (działalność nierejestrowana)** in 2026: allowed if your revenue in **any quarter does not exceed 225% of the minimum wage = 10,813.50 zł** (minimum wage in 2026: 4,806 zł), and you have not run a registered business in the last 60 months. Above that, you must register a business (CEIDG) within 7 days.
- Declare the income in your annual PIT return. Ask an accountant (księgowa/księgowy) once at the start; it is cheap insurance.
- The site already states it is **not legal advice**. Keep that text.

---

## 11. Quick checklist

- [ ] 2FA on email, GitHub, Cloudflare, registrar, BuyCoffee
- [ ] Repository renamed, description and topics set, made private, default branch `main`
- [ ] Domain bought, transfer lock on; domain replaced in 3 files if it differs
- [ ] Cloudflare Pages: build command `node scripts/check.mjs`, output folder `public`
- [ ] Custom domain connected, HTTPS works, securityheaders.com shows a top grade
- [ ] `buyCoffeeUrl` set and tested
- [ ] `owner` name and email filled in
- [ ] Partner link added (when you have a signed agreement)
- [ ] Google Search Console verified, sitemap submitted
- [ ] Monthly: NBP rate check → `extraRates` + `ratesVerified` + FAQ sentence
