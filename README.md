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
```

The browser test uses a Linux headless Chromium package by default. Set `AURA_CHROMIUM` to a local Chromium executable on another supported host. The workbench is usable without credentials. Anonymous preview role switching affects only the on-device sandbox; it never grants API access.

## What runs offline

The web build precaches its shell, fonts, assets and module chunks on the first successful HTTPS visit. Capacitor bundles these resources into the APK for first launch without a connection. Dexie persists dated observations, recent price samples, source history, market rules and alert evidence, corporate notices, research and studies, paper trades, sandbox receipts, and compliance checklists. Nothing in the paper ledger is sent to Supabase or Safaricom. Hosted responses, fresh publisher data, and external source pages require connectivity. Device caches are not backups; users can export or erase their local histories in Settings.

## Deploy the web terminal

1. Import this repository into a Vercel project using the Vite preset. `vercel.json` specifies `npm run build`, the `dist` output, SPA routing, and the Node functions in `api/`.
2. To use accounts, apply `supabase/migrations/202611180001_aura_desk.sql` to the **intended** Supabase project. Provision accounts using Supabase Auth; do not expose privileged keys to the browser. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for the client and `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` for the Vercel functions. Set `VITE_ENABLE_PREVIEW_ROLES=false` for production.
3. Grant the Lead Quantitative Analyst role through a trusted administrator updating the user’s **app metadata** to `{"aura_role":"admin"}`. Other accounts are members. Users cannot grant themselves roles by editing profile metadata. Hosted configuration and audit APIs validate the access token and current role with Supabase. Row-level policies enforce current administrator status and owner isolation for configuration records. An authorized admin can switch to the member view; the browser role toggle does not change grants.
4. For the Android preview, use the same API and Supabase deployment. Set `AURA_ALLOWED_ORIGINS=https://localhost` on the API (the Capacitor WebView origin). Web API calls are relative and same origin. The public deployment uses the **stocks** Supabase project; only Aura-namespaced settings and research quota objects are added. Manage any new accounts in the Supabase dashboard without changing shared auth configuration.

### Connect Groq

- **Your key**: Open **AI Research → Groq setup** or **Settings → Research connection**. Choose **Groq · My API key**, paste a key from [Groq Console](https://console.groq.com/keys), and click **Save key → Test Groq connection**. No Supabase sign-in is required in this mode. No key is sent to AuraTrade’s API or included in device exports. With **Remember on this device** enabled, the key is saved in the browser or WebView’s local storage. Other scripts with access to the same origin can read it, so prefer session-only storage on shared devices.
- **Vercel key**: Set `GROQ_API_KEY` as a sensitive Vercel environment variable (never `VITE_GROQ_API_KEY`), optionally set `GROQ_MODEL` (defaults to `openai/gpt-oss-20b`), and redeploy. Sign in with an existing workspace user whom an administrator has authorized through app metadata (`aura_role: "admin"` or `aura_ai: true`), then select **Groq · Vercel workspace** and test the connection. The server validates access and permits 20 hosted calls per UTC clock hour per account, including connection tests. Never send passwords or API secrets in issues or chat.
- **Local research** works without credentials and without a connection. Remote modes send only the submitted question and related market notes to Groq (via Vercel in workspace mode). Provider errors are shown with a labeled local fallback. The app does not let the model fetch arbitrary URLs or execute trades. Source links identify the evidence used to prepare a brief, not independent verification of generated wording.

### Market Pulse, history, and alerts

**Market Pulse** checks its small quote endpoint every 15 seconds while online and visible on the web or in the foreground on Android. Quote timestamps are publisher observations; “Checked” is the device’s refresh time. Crypto observations are indicative minute marks, not exchange executions. Macroeconomic feeds refresh separately on launch or resume and every 15 minutes.

- **BTC/USD and ETH/USD** use [Coin Metrics Community API](https://gitbook-docs.coinmetrics.io/access-our-data/api) reference rates, including the latest two hours of minute marks and up to one year of daily marks. Enable `AURA_COMMUNITY_CRYPTO=true` for **non-commercial research only**. The data is credited to Coin Metrics under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). AuraTrade formats, subsets and derives descriptive statistics from the source data. Disable the community feed and use an appropriately licensed vendor before commercial distribution.
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

The distributed preview uses the same app ID and preview signing certificate as the previous download. Keep the signing key private and reuse that certificate for in-place preview updates. The production signing configuration is separate. `public/app/android.json` records the distributed version, size and checksum.
