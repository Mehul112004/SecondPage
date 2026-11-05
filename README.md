# SecondPage

Two clients for the same private NIFTY paper trading workspace:

```text
SecondPage/
├── SecondPage-Web/    Next.js website, API, Supabase migrations and server secrets
└── SecondPage-App/    Expo / React Native app for iOS and Android
```

The Git repository stays at this root. Each project has its own dependencies and lockfile. The original website, environment file, SQL migrations, tests and installed dependencies have moved into `SecondPage-Web`.

## Run locally

Use Node 22.13+ (Node 22 LTS recommended). Install each project's dependencies after cloning:

```sh
npm --prefix SecondPage-Web install
npm --prefix SecondPage-App install
```

Start the website/API in one terminal:

```sh
npm run dev:web
```

Start Expo in another:

```sh
npm run dev:app
```

The app opens in a labelled synthetic demo when all three `EXPO_PUBLIC_` settings are blank. To connect it to the existing account, copy just the public Supabase settings from the web environment and use this computer's LAN address for the API:

```sh
npm --prefix SecondPage-App run setup:local
```

Restart Expo after environment changes. A physical phone must be on the same network and able to reach the web server on port 3000. See [the app guide](SecondPage-App/README.md) for Expo Go, development builds and a manual test checklist. See [the web guide](SecondPage-Web/README.md) for account activation, Upstox and scheduled monitoring.

## Shared behavior

Both clients use the same Supabase accounts, balances, positions, fills and server-side execution rules. The app authenticates API requests with a verified Supabase access token; browser requests retain cookie authentication and same-origin mutation checks. Upstox tokens and service-role credentials remain on the web server.

Native accounting and quote rules are identical copies of the web functions, checked by a parity test. After changing these functions, run `npm --prefix SecondPage-App run sync:domain`.

```sh
npm run typecheck
npm test
npm run lint:app
npm run build
npm --prefix SecondPage-App run export
```

For deployment, set the hosting service's project root to `SecondPage-Web`. The existing `/api/monitor` endpoint and Supabase schedule continue to handle background TP/SL. No database migration is required for the native client. Use the deployed HTTPS web origin as the app's API URL for release builds.
