# AuraTrade East Africa

AuraTrade is an offline-ready research terminal for Kenyan markets. It combines a 15-second foreground market pulse, sourced history and conditional outlooks, a shock-transmission lab, local and Groq research, a Kenyan regulatory directory, and an NSE paper-trading desk with a simulated order book. It does **not** connect to brokers, send M-Pesa requests, handle actual funds or provide investment, tax or legal advice.

## Run and verify

```bash
npm ci                    # Node.js 22
npm run dev               # Vite on 0.0.0.0:5173
npm run lint
npm test                  # transactional ledger, feed, analytics and authorization tests
npm run build             # production SPA and offline app shell
npm run test:browser      # production-browser workflow and offline test
node tests/account-browser.mjs # account entry, PKCE, permissions and offline session fixtures
```

The browser test uses a Linux headless Chromium package by default. Set `AURA_CHROMIUM` to a local Chromium executable on another supported host. An unconfigured **local web development** build can run a sandbox without credentials. Its preview role switch never grants API access. The deployed web app and Android account builds open at sign-in.

## What runs offline

The web build precaches its shell, fonts, assets and module chunks on the first successful HTTPS visit. Capacitor bundles these resources into the APK. First sign-in needs a connection; a restored session can use saved local features offline, without hosted privileges. Dexie persists dated observations, recent price samples, source history, market rules and alert evidence, corporate notices, research and studies, paper trades, sandbox receipts, and compliance checklists. Nothing in the paper ledger is sent to Supabase or Safaricom. Hosted responses, fresh publisher data, and external source pages require connectivity. Device caches are not backups; users can export or erase their local histories in Settings.

## Deploy the web terminal

1. Import this repository into a Vercel project using the Vite preset. `vercel.json` specifies `npm run build`, the `dist` output, SPA routing, and the Node functions in `api/`.
2. Apply both SQL migrations under `supabase/migrations/` in order to the **intended** Supabase project before deploying the workspace API. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for the client and `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` for the Vercel functions. Set `VITE_REQUIRE_ACCOUNT=true` and `VITE_ENABLE_PREVIEW_ROLES=false`. Never expose a service-role or secret key in the client.
3. Enable GitHub OAuth and email signup in Supabase Auth. The GitHub OAuth app callback is `https://<project-ref>.supabase.co/auth/v1/callback`. Append the following exact **app return URLs** to the Supabase redirect allowlist, without changing unrelated URLs or the shared Site URL:
   - `https://auratrade-east-africa.vercel.app/auth/callback` (substitute your public hostname for another deployment)
   - `africa.auratrade.terminal.accountpreview://auth/callback` (public Android preview)
   - `africa.auratrade.terminal://auth/callback` (Android release)

   Set `VITE_AUTH_SITE_URL` to the canonical HTTPS web origin. GitHub and signup from other web deployment URLs send users to the canonical site rather than allowlisting arbitrary preview hosts. The callback exchanges a one-time PKCE code in the browser or app where the flow began; it does not accept access/refresh tokens in URLs. GitHub or email signup starts with Research Member access. Keep email confirmation enabled. [Configure Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) before offering email signup publicly; the default mailer only delivers to project team addresses. GitHub is available without the AuraTrade confirmation email.
4. Grant Lead Analyst access only to a verified Supabase user ID through the private `aura_private.desk_leads` table, or through trusted app metadata `aura_role: "admin"`. The public deployment grants the linked `kennedy-blip` repository owner access after verifying the numeric GitHub identity. Only a trusted administrator can add or revoke grants. The API verifies the Supabase access token and uses `aura_workspace_access()` for the same current permission that protects desk configuration under RLS. A role toggle only changes the view. Members never receive Lead Analyst controls; `aura_ai: true` in trusted app metadata is an optional **AI-only** grant.
5. For builds on Android, use the same API and Supabase project. Set `AURA_ALLOWED_ORIGINS=https://localhost` on the API (the Capacitor WebView origin). Web calls are relative and same origin. AuraTrade uses the shared **stocks** project; its added database objects and role grants are AuraTrade-specific.

The footer shows **Web build** and the deployed Git revision. Open the canonical site or reopen the installed web app while online to get the new shell. Do **not** clear site data. Device data already tied to your account appears after sign-in on the same browser or app. If a previous guest workspace exists in the same storage, **Settings → Device storage → Restore earlier device activity** can copy it into an empty account workspace once, without moving credentials, overwriting activity, or uploading any data. The hosted workflow checks the exact web SHA, the desktop/mobile entry gate, offline shell and the real GitHub authorization handoff without signing into a user account.

### Connect Groq

- **Your key**: Open **AI Research → Groq setup** or [Settings → Groq connection](https://auratrade-east-africa.vercel.app/settings#research-connection). Click **Use my Groq key**, paste a key from [Groq Console](https://console.groq.com/keys), and click **Save key → Test Groq connection**. No shared Groq permission is required after signing in. The choice applies to new questions, not saved answers. No key is sent to AuraTrade’s API or included in device exports. With **Remember on this device** enabled, the key is saved in the browser or WebView’s local storage. Other scripts with access to the same origin can read it, so prefer session-only storage on shared devices.
- **Vercel key**: Set `GROQ_API_KEY` as a sensitive Vercel environment variable (never `VITE_GROQ_API_KEY`), optionally set `GROQ_MODEL` (defaults to `openai/gpt-oss-20b`), and redeploy. Sign in with an existing workspace user with verified Lead Analyst or AI-only permission. In Settings or AI Research, choose **Use workspace Groq → Test Groq connection**. The server validates access and permits 20 hosted calls per UTC clock hour per account, including connection tests. Never send passwords or API secrets in issues or chat.
- **Local research** works without a Groq key or network connection after a session is restored. Remote modes send only the submitted question and related market notes to Groq (via Vercel in workspace mode). Provider errors are shown with a labeled local fallback. The app does not let the model fetch arbitrary URLs or execute trades. Source links identify the evidence used to prepare a brief, not independent verification of generated wording.

### Market Pulse, history, and alerts

**Market Pulse** checks its small quote endpoint every 15 seconds while online and visible on the web or in the foreground on Android. Quote timestamps are publisher observations; “Checked” is the device’s refresh time. Crypto observations are indicative minute marks, not exchange executions. Macroeconomic feeds refresh separately on launch or resume and every 15 minutes.

- **BTC/USD and ETH/USD** use [Coin Metrics Community API](https://gitbook-docs.coinmetrics.io/access-our-data/api) reference rates, including the latest two hours of minute marks and up to one year of `PriceUSD` daily closes. Enable `AURA_COMMUNITY_CRYPTO=true` for **non-commercial research only**. The data is credited to Coin Metrics under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). AuraTrade formats, subsets and derives descriptive statistics from the source data. Disable the community feed and use an appropriately licensed vendor before commercial distribution.
- **Nairobi:** CBK/NSE observations are dated references until an authorized publisher is connected. See the [NSE licensed vendor directory](https://www.nse.co.ke/dataservices/nse-licensed-information-vendors/). With permission, configure `AURA_QUOTE_FEED_URL`, `AURA_QUOTE_FEED_NAME`, `AURA_QUOTE_FEED_SOURCE`, and optionally `AURA_QUOTE_FEED_TOKEN` (server-only bearer token). For licensed daily histories configure `AURA_HISTORY_FEED_URL` on the same source. AuraTrade does not infer intraday prices from a bulletin or weekend session.
- **Outlooks** use 5- and 10-observation averages, the previous 10-observation range, and observed return variation. The app shows conditional continuation and invalidation scenarios, plus descriptive historical analog outcomes when at least eight matches exist. These are not forecast probabilities, independent trials, or investment advice. An archived series displays an explicit archive label and date.
- **Alerts** are device-local and only evaluated with the app open. A price crossing requires two fresh observations from the same source and fires once until re-armed. Range breaks require contiguous minute samples and a change in the setup. Data gaps are not filled with invented observations. The bell and alert inbox link each alert to its source. No background notifications or trades are sent.

The licensed quote adapter expects `{"quotes":[{"id":"scom","price":35.15,"at":"2026-11-18T12:12:04Z","mode":"live"}]}` (example shape, not a quote). Allowed modes: `live`, `indicative`, `delayed`, `closed`; a timestamp alone never makes a delayed feed live. Optional `change` is a numeric percentage supplied by the publisher. The daily adapter receives `?id=scom&interval=1d` and expects `{"id":"scom","interval":"1d","points":[["2026-11-17",34.9],["2026-11-18",35.15]]}`. The allowlist and units are in `src/data/pulse.js`.

### Observations, notices, and benchmarks

The bundled market archive uses the 12 November 2026 CBK/NSE reporting window, October 2026 KNBS CPI, and separately dated sources for GDP, energy, tea, and corporate notices. The November fuel caps cite reporting on the EPRA announcement and are not live pump quotes. Market cards include observation dates. The archived chart does not substitute indicative quotes for actual closes. The data module stores market history in compact aligned date/value columns; the offline cache adds source, date, and provenance indices.

- **FRED**: fetches public DGS10, SP500 and Brent CSV observations by default. Set `AURA_FRED_ENABLED=false` to disable the connection. Follow the series publisher’s redistribution terms, particularly for proprietary index data.
- **Alpha Vantage**: `ALPHA_VANTAGE_API_KEY` enables the two-year US Treasury feed. Keep this and other provider keys server-side.
- **CBK, KNBS, EPRA, EATTA, NSE**: official archives are included. For updates, configure the corresponding `*_FEED_URL` as an operator-managed HTTPS normalizer that you control. If reporting is PDF or HTML, ingest it upstream and preserve the original official document URL. The service validates series IDs, source hosts, and dates and does not scrape unstable page layouts or advance dates on failures. A failed feed leaves the last cached observation intact.
- **MMFs**: the included rates are illustrative, not current quotes. Set `MMF_FEED_URL` for dated fund manager disclosures. Compare annualization, taxes, fees, liquidity, and credit risk separately; the comparison is not a promise of return.
- **Sheng / Swahili and wires**: sentiment compares submitted or illustrative retail text with source-linked institutional examples by default. For a licensed feed, set `SENTIMENT_FEED_URL` and `SENTIMENT_PUBLISHERS` (a comma-separated exact hostname allowlist). Supply only pre-redacted excerpts approved for public redistribution, with no handles, account information or other personal data. The server's basic text checks are not a substitute for redaction.

Supported normalizer response:

```json
{
  "rows": [
    {"id":"cbr","value":8.75,"asOf":"2026-10-07","period":"MPC decision","delta":0,"changeUnit":"bps","url":"https://www.centralbank.go.ke/"}
  ],
  "events": [
    {"id":"mpc-oct-26","date":"2026-10-07","title":"MPC holds the policy rate at 8.75%","detail":"The committee left the Central Bank Rate unchanged.","url":"https://www.centralbank.go.ke/"}
  ]
}
```

Each source may publish rows, events, or both where applicable. Series IDs and units are allowlisted in `server/feeds.js`; the separate sentiment response uses `{"excerpts":[{"id":"release-1","channel":"wire","date":"2026-11-13","text":"…","publisher":"Publisher name","url":"https://approved-publisher.example/release"}]}`. The default date stamp denotes the observation or release, not the time of the request. Local replay quotes and tax calculations are independent of provider credentials.

## Android APK

From the preview, use **Android App → Download Android APK**, or open **Settings → Android app**. The included file is a signature-verified, sideloadable **preview** build (`africa.auratrade.terminal.preview`); it is not a Play Store release or signed with your production key. A preview signed with a different certificate cannot update this APK in place. Use Android 8+ (API 26) with Android System WebView 111 or newer. Web workflows have browser coverage; the included APK has package and signature checks but has not been exercised on a physical device in this environment.

To build using the checked-in Capacitor Android project, install JDK 21, Android SDK Platform 35, and Build Tools 35, then set `ANDROID_HOME`:

```bash
npm run android:preview    # signed preview namespace, non-debuggable
npm run android:debug      # local debug variant
npm run android:release    # APK signed with your configured key
npm run build              # place the published APK and its SHA-256 metadata in dist
```

For a release, supply `AURA_KEYSTORE`, `AURA_KEYSTORE_PASSWORD`, `AURA_KEY_ALIAS`, and `AURA_KEY_PASSWORD` through your deployment environment or CI secrets. Never commit the keystore or passwords. The **Android package** workflow builds a preview when Android packaging files change and accepts a manual signed-release request when enabled. It uploads the binary and checksum metadata as CI artifacts and attempts to install and boot the CI preview on an API 35 emulator. Use `scripts/publish-apk.mjs` to place a pre-verified signed build under `public/app/`, or set `VITE_ANDROID_APK_URL` to the HTTPS download URL of your signed release. For Vercel, ensure the APK is either uploaded to your deployment storage or is available when the frontend build runs. Native builds exclude the web APK asset to avoid nesting APKs. If the APK should reach the hosted services, build with `VITE_API_BASE_URL` pointing to your HTTPS API and set `AURA_ALLOWED_ORIGINS=https://localhost` on that API for the Capacitor WebView origin. Browser builds use same-origin relative API paths.

Version 1.2.0 **AuraTrade Account Preview** (`africa.auratrade.terminal.accountpreview`) installs alongside the earlier 1.1 preview. The original 1.1 signing key was not available for an in-place update. Keep the old app installed to retain its local data; separate Android packages do not share local storage. This download is a sideloadable preview, not a Play Store or production-signed build. In-place updates require the same package ID and original private signing certificate. Use a securely managed persistent signing key before distributing updateable production releases. `public/app/android.json` records the delivered package, version, size and checksum.
