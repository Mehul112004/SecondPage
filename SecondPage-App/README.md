# SecondPage App

Expo SDK 58 + React Native + TypeScript, using the website's design and trading logic. Native screens implement the practice desk, option chain, order ticket, portfolio, TP/SL editor, trade history, invitation-only login, and execution notifications.

The app keeps the website's palette, typography, metrics, bid/ask chain, bracket shortcuts, confirmations and position cards. Bottom navigation provides the same workspace destinations; order entry and bracket editing use keyboard-aware sheets with actions at the bottom.

## Start

Use Node 22.13+ (22 LTS recommended):

```sh
npm install
npm start
```

Scan Expo's QR code with Expo Go compatible with SDK 58, or use `npm run start:dev-client` with an installed development build. No simulator or device was launched during implementation. Expo Go has limitations for notifications; the configured development build includes `expo-dev-client` and the notification plugin.

With no public environment settings, the app runs the same clearly labelled synthetic demo: ₹50,000 starting funds, ask buys, bid closes, 1–100 lots, TP/SL monitoring while active, in-memory history and alerts. Reloading the app resets demo trades. Configured accounts never fall back to synthetic quotes.

## Connect your existing account

The original Next.js app is the API server. Start it from `../SecondPage-Web`, then run:

```sh
npm run setup:local
```

This creates an ignored `.env.local`, copying **only** the two public Supabase values from the existing web environment. It chooses this computer's LAN address for the API. Rerun it after changing networks, or set a specific backend origin:

```sh
EXPO_PUBLIC_API_URL=https://your-secondpage-web.vercel.app npm run setup:local
```

Alternatively copy `.env.example` to `.env.local` and fill in all three values:

```dotenv
EXPO_PUBLIC_API_URL=https://your-secondpage-web.vercel.app
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-public-key
```

Use an origin without `/api` or a trailing slash. A physical phone cannot use your computer's `localhost`: use its LAN IP, keep both devices on the same network, and allow access to port 3000. `10.0.2.2` reaches the host from the Android emulator. Use HTTPS for deployed/release builds. Restart Metro with `npx expo start --clear` after changing environment values.

Sign in with an existing account activated by the owner. Account activation and RLS checks remain enforced on every server API call. Native sessions persist in chunked Expo SecureStore entries on iOS/Android; the optional web preview uses AsyncStorage. Signing out removes the local session.

Service-role keys, Upstox credentials, and monitor secrets must stay in `SecondPage-Web/.env.local` or its server deployment. Expo public variables are bundled into the app. The setup script never copies server secrets.

## Execution and monitoring

- Same Supabase workspace and server-side quote/market checks as the website; no real broker orders.
- Five-second polling while foregrounded, immediate refresh on return, pull to refresh, and stale-feed order blocking.
- Long options, whole-position closes, variable provider lot sizes, account equity, bid-marked unrealized P&L, realized P&L and fill history.
- TP/SL presets at 10%, 20% and 30%, or manual price levels. Clear removes a bracket.
- In-flight requests cannot overwrite confirmed mutations. An uncertain order response blocks more orders until you check history and manually refresh; orders are not automatically retried.
- The existing server Cron job handles exits while the app is closed. Persisted execution alerts appear on the next visit. Optional local device alerts report new exits observed while the app is open. Offline remote push delivery is not configured.

## Checks and builds

```sh
npm run typecheck
npm run lint
npm test
npm run export
```

`export` produces iOS and Android JS/Hermes bundles in `dist`; it does not create an APK/IPA or launch a device. Domain parity, accounting, bracket triggers and large-session storage have automated checks. Run `npm run sync:domain` after changing the web's `market.ts` or `trading/quote-rules.ts`.

EAS profiles are provided, but no build has been submitted or published. Configure your own Expo project and verify the app identifiers before distributing:

```sh
npx eas-cli@latest build --profile development --platform ios
npx eas-cli@latest build --profile development --platform android
npx eas-cli@latest build --profile preview --platform android
```

Supply the three public environment values in the selected EAS environment before building. No native `ios/` or `android/` source directories are checked in; Expo generates them from `app.json`.

## Manual testing

1. Open the unconfigured demo. Select a call/put, change lots, apply TP/SL shortcuts, confirm a buy, edit its brackets, and close it. Check cash, equity, P&L, closed positions and history.
2. Connect the existing backend and sign in with an active account. Confirm that balances and trades match the website. Check an inactive account is denied private data and orders.
3. During normal market hours, select different expiries and open contracts, verify bid/ask updates and lot sizes, and place/close virtual orders. Check position timestamps and capital used.
4. Disconnect the network and background/resume the app. Orders should block until fresh data returns. After an uncertain order result, check history and pull to refresh before retrying.
5. Enable device alerts in a development build. Trigger a TP/SL exit, confirm its saved alert, then verify existing server monitoring while the app is closed.
6. Check smaller screens, tablet layout, keyboard access to sheet actions, screen reader labels, sign-out and session restoration.

Implementation follows [Expo SDK 58 documentation](https://docs.expo.dev/versions/v58.0.0/), [Expo Router setup](https://docs.expo.dev/router/installation/), and [Supabase native authentication](https://supabase.com/docs/guides/auth/quickstarts/react-native).
