# AuraTrade East Africa

AuraTrade is an offline-ready research terminal for Kenyan markets. It combines dated primary-source observations, a shock-transmission lab, local and optional hosted research, a Kenyan regulatory directory, and an NSE paper-trading desk with a simulated order book. It does **not** connect to brokers, send M-Pesa requests, handle actual funds or provide investment, tax or legal advice.

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

The web build precaches its shell, fonts, assets and module chunks on the first successful HTTPS visit. Capacitor bundles these resources into the APK for first launch without a connection. Dexie persists dated observations, corporate notices, research and studies, paper trades, sandbox receipts, and compliance checklists. Nothing in the paper ledger is sent to Supabase or Safaricom. Hosted responses, fresh publisher data, and external source pages require connectivity. Device caches are not backups; users can export or erase their local histories in Settings.

## Deploy the web terminal

1. Import this repository into a Vercel project using the Vite preset. `vercel.json` specifies `npm run build`, the `dist` output, SPA routing, and the Node functions in `api/`.
2. To use accounts, apply `supabase/migrations/202611180001_aura_desk.sql` to the **intended** Supabase project. Provision accounts using Supabase Auth; do not expose privileged keys to the browser. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for the client and `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` for the Vercel functions. Set `VITE_ENABLE_PREVIEW_ROLES=false` for production.
3. Grant the Lead Quantitative Analyst role through a trusted administrator updating the user’s **app metadata** to `{"aura_role":"admin"}`. Other accounts are members. Users cannot grant themselves roles by editing profile metadata. Hosted configuration and audit APIs validate the access token and current role with Supabase. Row-level policies enforce current administrator status and owner isolation for configuration records. An authorized admin can switch to the member view; the browser role toggle does not change grants.
4. For hosted research, set `AURA_RESEARCH_API_KEY` and, if needed, `AURA_RESEARCH_MODEL` and `AURA_RESEARCH_ENDPOINT` for an HTTPS OpenAI-compatible provider. The server enforces a per-account quota. Signed-in users opt in explicitly before sending research questions to the provider. Tool results supply source references; generated prose is synthesis, not independent verification. Without credentials or on service failure, the same four specialist paths run locally using documented rules and calculations. Do not submit confidential or personal information to a model provider.

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
npm run android:debug      # sandbox APK
npm run android:release    # APK signed with your configured key
npm run build              # place the published APK and its SHA-256 metadata in dist
```

For a release, supply `AURA_KEYSTORE`, `AURA_KEYSTORE_PASSWORD`, `AURA_KEY_ALIAS`, and `AURA_KEY_PASSWORD` through your deployment environment or CI secrets. Never commit the keystore or passwords. The manual **Android package** workflow prepares a preview or a signed release and uploads the binary and checksum metadata as CI artifacts. Use `scripts/publish-apk.mjs` to place a pre-verified signed build under `public/app/`, or set `VITE_ANDROID_APK_URL` to the HTTPS download URL of your signed release. For Vercel, ensure the APK is either uploaded to your deployment storage or is available when the frontend build runs. Native builds exclude the web APK asset to avoid nesting APKs. If the APK should reach the hosted services, build with `VITE_API_BASE_URL` pointing to your HTTPS API and set `AURA_ALLOWED_ORIGINS=https://localhost` on that API for the Capacitor WebView origin. Browser builds use same-origin relative API paths.

The preview package was compiled with the checked-in Capacitor native source and web bundle using Android SDK tooling; its package ID and preview certificate are separate from the official Gradle release configuration. `public/app/android.json` records its version, size and checksum.
