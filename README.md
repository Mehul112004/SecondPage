# SecondPage

A private Next.js + Supabase paper trading app. No separate backend process.

## Run now (no credentials needed)

Requires Node 22+ and npm (the current Supabase SDK requires Node 22).

```sh
npm install
npm run dev
```

Open http://localhost:3000. Without Supabase configuration the app presents a **synthetic demo**. Prices update every five seconds; demo trades live only in memory and clear on refresh. This contains no private account information and does not bypass the authenticated APIs. `/login` previews the login screen.

```sh
npm run build
npm run typecheck
npm test
```

## Enable private accounts

1. Create a **Supabase Free** project.
2. In its SQL editor, run `supabase/migrations/001_private_trading.sql` once, then `supabase/migrations/002_brackets_and_wallet.sql` once. This creates accounts, positions, fills, RLS policies and an atomic order function. No tick table exists.
3. Under Authentication configuration, **disable new user signups**, anonymous sign-ins, and unused identity providers. There is no signup UI or signup endpoint in this app. Disable signups at Supabase too; hiding a button alone is not access control.
4. Under Authentication → Users, manually create an email/password user (auto-confirm the email if no mail delivery is configured). The migration provisions an inactive profile and ₹50,000 virtual wallet for every new user.
5. Activate that user explicitly in the SQL editor:

```sql
update public.profiles set active = true
where id = (select id from auth.users where email = 'your-email@example.com');
```

6. Copy `.env.example` to `.env.local`. Add your project URL, publishable key (legacy anon key also works), and the **server-only** service-role key. Find these in the Supabase project settings. Never put the service-role key in a `NEXT_PUBLIC_` variable or commit it. The application uses that key only for validated fills; ordinary reads use the user's session and RLS.
7. Restart Next.js and sign in. New accounts receive ₹50,000 of virtual funds.

To revoke access, set the user's `profiles.active` to `false` in the dashboard. Every data read and order operation checks that flag; RLS also denies private trading reads. Manage password resets manually in Supabase for now. Do not rely solely on deleting a user to immediately revoke existing JWTs.

## Trading model

- Synthetic NIFTY-style calls and puts, illustrative lot size 25, no expiry. These are **not live market contracts or historical replay**.
- Buy 1–100 whole lots at the server's current ask; close the whole position at the server's current bid.
- Long options only. No short selling, partial closes, limit orders, fees, taxes, expiry settlement, or margin model yet. Optional TP/SL prices can be entered with a buy and edited/removed on open positions.
- Server validates authentication, active access, contract, lots and origin. Database locks the wallet and atomically updates cash, position and fill. Browser roles cannot write balances or invoke the fill function. Request IDs prevent duplicate fills on retries of the same request.
- Store entry/exit executions, quantities, ownership and status. **Do not persist incoming quotes or calculated unrealized P&L.** Open P&L is calculated in the browser as `(bid - entry) × lots × lot size`. Using the bid estimates liquidation value. Quotes are discarded after the next update. Stale feeds disable orders.
- Dashboard loads the most recent 1,000 positions and 100 fills; pagination is needed before exceeding those personal-use limits.

## Connect market data later

`src/lib/market.ts` is the synthetic adapter used by both the quote API and server-side fills. Replace its quote source and the corresponding contract catalogue/SQL validation together with an approved data provider. Keep provider credentials server-only. Validate timestamps and quote availability server-side before real-feed simulations. Historical replay needs an actual licensed dataset; none is bundled. Supabase is storage/auth, not a market-data provider.

The current short-lived polling route fits serverless Next.js. A continuous provider WebSocket cannot simply stay open in a Vercel function. A future feed integration needs a provider-supported browser connection or request-based API that fits hosting limits. Never persist every tick just to update open P&L.

## Free hosting

Import this repo into **Vercel Hobby**, select Next.js and set the same three environment variables. Configure Supabase's Site URL to the deployed HTTPS URL. Keep the project on Supabase Free and Vercel Hobby; do not enable paid upgrades/add-ons. Free quotas may interrupt service, and Supabase may pause inactive projects. Large historical datasets and licensed market data may not be free. No hosting resources are created by running this repository.

Do not enable public access to real market data without verifying provider permissions. Personal use does not automatically grant a data licence.

## Verification limits

Verified compilation on Node 22, demo trade calculations, unauthenticated API rejection, and browser buy/close flows. The migration, atomic fills, request deduplication, overspending rejection, cross-user RLS isolation and disabled-user access were tested on isolated local PostgreSQL using a minimal Supabase auth schema stub. `tests/database.sql` records those transaction/isolation assertions for a disposable database. Hosted Supabase login/session refresh still requires your project; run `supabase/verify.sql` there after setup to check key grants and RLS flags.


## Upgrade an existing project: TP/SL and ₹50,000 wallet

If migration 001 is already applied, run **only** `supabase/migrations/002_brackets_and_wallet.sql` in the Supabase SQL editor. It changes new wallets to ₹50,000 and subtracts the previous ₹9.5 lakh allocation from existing cash balances where sufficient cash is available, preserving trades and their P&L. Wallets with less than ₹9.5 lakh cash are left unchanged for manual review; they are not wiped or made negative. Do not run migration 002 twice.

### Automatic exits while the app is closed

1. Enable **pg_cron / Supabase Cron** under Integrations → Cron (or Database → Extensions).
2. Run `supabase/enable-monitor.sql` in the SQL editor. It creates the `secondpage-brackets` job every five seconds, plus a daily cleanup for its execution logs.
3. Verify the job in Integrations → Cron and check its run history for successful executions.

This monitor is implemented for the **synthetic fixture feed only**: it computes the same quote in PostgreSQL without saving it. It reads only protected open positions, locks each wallet, rechecks the position and writes the close + wallet update + fill + notification atomically. Concurrent manual closes and monitor invocations cannot credit a wallet twice. Stop-loss checks have priority. A crossed level executes at the observed bid, not a guaranteed stop/target price; prices can cross and return between checks. The workspace also checks triggers on refresh. Without Cron, it cannot monitor while all app tabs are closed. Checks stop when Supabase is paused or unavailable.

TP must be above entry and SL positive and below entry. Either level may be blank. Changing a level that's already crossed can cause an exit on the next check. No tick history or unrealized P&L is stored.

Triggered exits create **persistent in-app notifications**. When the app is open, it polls every five seconds and displays new alerts. The optional “Enable desktop alerts” button requests browser notification permission; those alerts also require an open app tab and browser support. This is not offline Web Push, email, or SMS. An offline exit's in-app alert appears on the next visit.

When a real market-data provider is connected, replace BOTH the server quote adapter and the database synthetic monitor with provider-backed monitoring. Do not apply the synthetic monitor to real contracts. Real-feed background monitoring is not connected yet.
