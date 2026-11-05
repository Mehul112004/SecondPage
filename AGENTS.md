# Repository layout

- `SecondPage-Web` contains the existing Next.js site, API and Supabase setup. Its Next.js guides resolve at `SecondPage-Web/node_modules/next/dist/docs/`.
- `SecondPage-App` contains the Expo / React Native client. Follow its own `AGENTS.md` and matching SDK documentation.
- Keep independent dependencies and lockfiles in the two projects; `.git` stays at this root.
- Do not use computer use, browser automation or a simulator to test this implementation. The user will test it manually; static checks and unit tests are allowed.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
