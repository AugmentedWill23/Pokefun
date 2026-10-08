# PokeRogue upstream contract (checked 2026-10-08)

This project serves a locally built copy of the public PokeRogue browser client and proxies its account/game API to the official PokeRogue service. It does not host a replacement backend or claim to be an official PokeRogue deployment.

## Frontend build

The client source is <https://github.com/pagefaultgames/pokerogue/tree/2e2f53958ed4080947abf4ab4c3fa8fe1919c6d1>, pinned to beta commit `2e2f53958ed4080947abf4ab4c3fa8fe1919c6d1`. Its `assets/` submodule is pinned to <https://github.com/pagefaultgames/pokerogue-assets/tree/9378069914157ea599308ef53ff972459276d3e8> at `9378069914157ea599308ef53ff972459276d3e8`; its `locales/` submodule is pinned to <https://github.com/pagefaultgames/pokerogue-locales/tree/0696f674f631b47f208f5d687b427ed3e7cd81b0> at `0696f674f631b47f208f5d687b427ed3e7cd81b0`.

The upstream `package.json` requires Node `>=24.9.0` and declares `pnpm@10.34.5`. Its production build is `pnpm build` (Vite/Rolldown). `vite.config.ts` sets `base: ""`, so built asset URLs are relative and the client can be served below `/game-site/`. The build used `VITE_BYPASS_LOGIN=0` and `VITE_SERVER_URL=https://api.pokerogue.net`; the Node server rewrites ordinary API origins in JavaScript to `window.location.origin`.

The upstream client uses an asset manifest; its JavaScript modules load additional chunks lazily. `server.mjs` serves every build file from `public/game-site/`, not just the initial HTML. It replays local JavaScript bytes while rewriting API URLs, including unchanged scripts; it preserves the official `/auth/{provider}/callback` URL embedded in the battle chunk.

## API, authentication, and saves

The official client constructs account requests against `https://api.pokerogue.net`; the API route groups used here are `/account/`, `/game/`, `/savedata/`, `/daily/`, `/auth/`, and `/admin/`. The upstream API expects the official game's Origin/Referer and returns CORS headers for its configured official game domain. The proxy sends those expected server-side headers and forwards account/game requests through the Wasmer site's origin. An unauthenticated `GET /account/info` returns `401 missing token`, which is expected; no account credentials were used in tests.

The backend's username/password login and registration handlers are documented in <https://raw.githubusercontent.com/pagefaultgames/rogueserver/master/api/account/login.go> and <https://raw.githubusercontent.com/pagefaultgames/rogueserver/master/api/account/register.go>. Login returns an API token for use with the official backend. Google/Discord callback domains are configured and registered by the official service, so this project preserves those callbacks and cannot promise social sign-in will stay on the Wasmer host. Browser-local saves remain hostname-scoped; account/cloud saves stay with the official backend. The proxy intentionally does not log or persist credentials, tokens, or request bodies, but traffic passes through its operator.

## License and asset handling

The upstream game README marks the source code **AGPL-3.0-only** unless otherwise noted. The asset README describes eligible assets as **CC-BY-NC-SA-4.0** only to the extent those terms apply and warns that assets without a `REUSE.toml` entry may have no licensing/copyright information. The asset repository marks `logo128.png`, `logo512.png`, `images/logo.png`, and `images/logo_fake.png` as `LicenseRef-NO-REUSE`; this build replaces those paths with fully transparent 1×1 PNG placeholders, not a proxy mark. `images/intro_dark.mp4` is also marked no-reuse; the included source patch removes it from the loading scene and displays the standard progress graphics instead. The output preserves the upstream code license, credits, locale license/readme, and asset `REUSE.toml` records under `public/game-site/notices/`. Several other assets are identified as `LicenseRef-FAIR-USE`; their presence does not create blanket redistribution permission. Review the bundled notice and file-specific upstream terms for the intended use.

The wrapper has no badge or logo overlay; its game iframe fills the viewport. The no-reuse game-logo placeholders are transparent, so no blue replacement mark appears in the game's loading/login view.

## Why the local frontend is needed

The earlier proxy fetched `https://pokerogue.net/` for the game HTML; the live Wasmer app received a Cloudflare challenge document instead of the real client. Serving the built client from this app removes that dependency. The production client still uses the official public API through the fixed-origin proxy.
