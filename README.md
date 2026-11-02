# SecondPage

Private Next.js + Supabase paper trading for NIFTY options, using Upstox market data. No real broker orders and no tick storage.

## Run

Requires Node 22+ and npm.

```sh
npm install
npm run dev
```

Open http://localhost:3000. Without Supabase settings, the app shows a clearly labelled synthetic demo whose trades clear on refresh. Configured accounts always use Upstox; provider failures never fall back to synthetic fills.

```sh
npm test
npm run typecheck
npm run build
```

## Supabase setup

Create a Supabase **Free** project. In its SQL editor, apply these migrations **once, in order**, skipping any already applied:

1. `supabase/migrations/001_private_trading.sql`
2. `supabase/migrations/002_brackets_and_wallet.sql`
3. `supabase/migrations/003_upstox_market_data.sql`

Migration 003 adds provider metadata to trade records, enables the provider-backed execution function and disables the old synthetic monitor/fill path. Do not run the old `enable-monitor.sql` after upgrading. Existing synthetic records are preserved as legacy history, not repriced or automatically closed using real quotes. Existing open synthetic or expired contracts without quotes are shown as unavailable and require manual account reconciliation; expiry settlement is not implemented.

In Authentication configuration disable **new user signups**, anonymous sign-ins and unused providers; keep email/password enabled. Create users manually under Authentication → Users (auto-confirm email if no email delivery is configured). The trigger creates an inactive profile and ₹50,000 wallet. Activate approved accounts in SQL:

```sql
update public.profiles set active = true
where id = (select id from auth.users where email = 'your-email@example.com');
```

Set `active = false` to revoke private data/trading access immediately through RLS and server checks. Manage password resets manually in Supabase. Do not rely only on deleting a user to revoke existing JWTs.

Migration 002 adjusts existing wallets by subtracting the previous ₹9.5 lakh starting allocation where sufficient cash is available, preserving execution P&L. Wallets below that cash threshold are left unchanged for manual review, not wiped or made negative.

## Environment

Copy `.env.example` to `.env.local` and fill in:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_KEY
UPSTOX_ANALYTICS_TOKEN=YOUR_READ_ONLY_TOKEN
MONITOR_SECRET=YOUR_RANDOM_SECRET
```

Only the two `NEXT_PUBLIC_` values are browser-safe. Never share/commit the other keys, prefix them with `NEXT_PUBLIC_`, or include them in URLs. The local environment file is ignored by Git. Rotate any credentials shared in chat.

Generate a random monitor secret with `openssl rand -hex 32`. Use the same value in the deployed server environment and Supabase Vault. The app's existing local environment may already contain a generated value; do not print or commit it.

## Upstox provider

Generate an Analytics Token at https://account.upstox.com/developer/apps → Analytics. It is used only for market-data GET endpoints, not orders, portfolio, funds or account information. Confirm provider permissions for your intended personal paper-trading use.

- Contract catalogue: `GET /v2/option/contract`, underlying `NSE_INDEX|Nifty 50`; current expiries and lot sizes come from Upstox, not hardcoded constants.
- Initial chain: `GET /v2/option/chain` for the selected expiry, selecting the nearest 21 strikes around spot.
- Five-second polling: batched `GET /v2/market-quote/quotes` for the displayed strikes **and all open contracts**, including positions in other expiries.
- Session state: `GET /v2/market/status/NSE`, combined with regular weekday 09:15–15:30 IST option-session boundaries. Provider session status handles holidays and non-normal sessions; special sessions outside regular hours are intentionally unsupported.
- Tiny request coalescing/ephemeral caches reduce duplicate calls within an instance (catalogue: 5 minutes; snapshots: 2 seconds; status: 3 seconds). No persistent quote cache or database tick table.
- Missing/expired instruments, expired credentials, outages, rate limits, crossed books or missing depth fail closed.

The latest quote and source timestamps live in memory. Browser P&L is `(current bid - entry price) × lots × stored lot size`; unavailable bids produce unknown P&L, not fabricated values. REST polling may miss a crossing between observations.

## Simulated fills

The server re-fetches quotes on orders and resolves contracts against the current catalogue. Browser-supplied prices and lot sizes are ignored. The database locks the wallet and atomically commits cash, position, fill and (for TP/SL) notification. Request IDs deduplicate retries, and database ownership/status checks prevent double close or cross-user execution.

Buys fill at the ask and closes at the bid. The whole order must fit the displayed best-price quantity and exchange freeze limit; partial fills are not implemented. No fills outside normal market hours. Provider quote/receipt timestamps must be within 15 seconds and last-trade time within 60 seconds. This deliberately rejects illiquid contracts even if a resting bid exists. A fresh HTTP response alone is not proof of a fresh quote. If an order waits too long for a wallet lock, the database rechecks its quote age.

Only trade details and metadata (instrument ID, display symbol, expiry, lot size, entry/exit prices, TP/SL, ownership/status) and execution notifications are stored. No tick history or unrealized P&L is persisted. Long options only; no short selling, partial closes, fees/taxes, margin model, expiry settlement or limit orders yet. Dashboard reads are bounded to 1,000 positions and 100 fills; add pagination before exceeding these personal-use limits.

## TP/SL and background monitoring

Set optional price levels when buying, or use “Set TP/SL” on an open position. TP must be above entry and SL positive and below entry. Blank removes a level. Triggered exits fill at the observed bid, not at a guaranteed target/stop price. The database rechecks levels under lock so concurrent edits/manual closes cannot cause duplicate exits.

While open, the app polls its authenticated workspace, which invokes provider-backed TP/SL checks for that user. **To monitor with all tabs closed**, deploy Next.js and configure the scheduler below. No permanently running Express server or WebSocket worker is required.

1. Deploy this repository to Vercel Hobby and configure all five environment variables. Configure Supabase's Site URL to the deployed HTTPS URL. Keep both services on their free plans; do not enable paid add-ons. Free quotas, pausing, unavailable services or missed scheduled runs can interrupt monitoring.
2. Enable `pg_cron`, `pg_net` and Vault in Supabase.
3. Add these secrets in **Supabase Vault**:
   - `secondpage_monitor_url`: `https://YOUR-APP.vercel.app/api/monitor`
   - `secondpage_monitor_secret`: the server's `MONITOR_SECRET` value
4. Run `supabase/enable-upstox-monitor.sql`. It dispatches a bearer-authenticated POST every five seconds during regular weekday market hours. The endpoint checks actual provider session status and quote freshness before any exit. The Upstox token remains only on the Next.js server.
5. Inspect both Cron run history **and** `net._http_response`: successful HTTP queueing does not mean the endpoint succeeded. The endpoint returns checked/closed counts and session status, never credentials.

To stop the job: `select cron.unschedule('secondpage-upstox-monitor');`. There is no hosted scheduler configured by merely running the repository. The dispatcher function requires Vault secrets, and localhost is not reachable from Supabase. Use a permanent deployment URL without an interactive deployment-protection gate so scheduled requests can reach the endpoint; app/endpoint authentication remains enforced.

Persistent in-app notifications appear on the next visit after an offline exit. Optional desktop notifications require browser permission and an open app tab; this is not offline Web Push, SMS or email.

## Validation

Unit tests cover demo accounting, P&L, provider normalization and mocked HTTP errors, expiry/open-position coverage, session/freshness/depth checks. `tests/upstox.sql` exercises provider-backed database fills, variable lot size, request deduplication, stale quote rejection, automatic SL, cross-user protection and notifications on a disposable PostgreSQL database after all migrations. Earlier `tests/brackets.sql` and `tests/database.sql` target migration 002's legacy synthetic model and should run before 003, not after it. `supabase/verify.sql` checks current browser grants and RLS flags on a configured project.

Hosted Supabase login/order flow and the deployed Cron callback must be verified after the migrations and deployment are configured. Market-hours live freshness still requires an open-session check.
