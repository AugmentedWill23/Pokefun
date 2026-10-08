# Wasmer dashboard upload

This handoff is for the existing app at `https://pokerogueaug.wasmer.app`. The new source is a Node application, not a static-only website. The game client is already built locally and packaged under `public/game-site/`; the Wasmer runtime only needs to start `server.mjs`.

## Upload and deploy

1. Download and extract `pokerogueaug-wasmer-upload.zip`. Upload the **contents** of the archive so the app root directly contains `package.json`, `package-lock.json`, `server.mjs`, `public/index.html`, `public/manus-routes.json`, `public/transparent.png`, and the complete `public/game-site/` tree. Do not leave the files nested one folder down. The game build is about 737 MB unpacked.
2. In the Wasmer application dashboard, use its Node.js application/runtime option. If it asks for a startup command, enter `npm start`; `package.json` contains that script and requires Node `>=24.9.0`. The server binds to `0.0.0.0` and honors the environment's `PORT` (default `8080`).
3. Save/replace the application files and trigger a fresh deploy in the dashboard. The source ZIP alone does not update the current live app; this task does not sign into Wasmer, upload files to your account, or trigger deployment.

If the dashboard only offers static-file hosting, this project will not work in that mode: static hosting cannot run the server-side API proxy. Choose the dashboard's Node app option if available. The code itself does not hardcode the domain; after deploying, Wasmer should route the app at the hostname assigned to it, including `pokerogueaug.wasmer.app` if that's the assigned address.

## Verify after deployment

Open these paths directly:

- `/_health` should return HTTP 200 and the text `ok`.
- `/` should return the black full-viewport iframe shell with **no proxy badge or overlay**.
- `/game-site/` should return the locally built PokeRogue client shell.
- `/game-site/asset-manifest.json` should return JSON listing a JavaScript entry and CSS; the corresponding `./assets/...js` and stylesheet paths should return HTTP 200 with nonempty content.
- `/account/info` without a token is expected to return HTTP 401 from the official API; it proves the proxy reached the account service, not that a login failed.

If the game remains blank after a successful deployment, first hard-refresh or clear site data for this host. Then use the browser Network panel: the `asset-manifest.json`, the JavaScript/CSS assets named there, and large game resources should be successful and nonempty. The prior version that proxied the upstream HTML could receive a Cloudflare challenge page; the new version serves the client locally and does not request that HTML.

## How this app works

The wrapper iframe at `/game-site/` and all built frontend assets are local files. Only `/account/`, `/game/`, `/savedata/`, `/daily/`, `/auth/`, and `/admin/` are proxied to `https://api.pokerogue.net`. For the upstream API's same-site checks, the server sends the official game's Origin/Referer while relaying the request. The client JavaScript's ordinary API origin is rewritten to this app's origin; the registered `/auth/{provider}/callback` URI is preserved. The proxy does not log or store credentials, tokens, or API bodies. The game view contains no added proxy information controls or blue logo placeholders.

## Build and source notes

The bundle uses PokeRogue beta commit `2e2f53958ed4080947abf4ab4c3fa8fe1919c6d1`, asset submodule commit `9378069914157ea599308ef53ff972459276d3e8`, and locales submodule commit `0696f674f631b47f208f5d687b427ed3e7cd81b0`. The upstream build uses Node `>=24.9.0` and `pnpm@10.34.5`. The source patch at `docs/patches/remove-no-reuse-intro.patch` removes the upstream no-reuse intro movie while preserving the standard progress UI; `scripts/prepare-frontend.mjs` replaces four no-reuse logo paths with transparent pixels and copies upstream notices into the output. The upload ZIP already contains the prepared production build; none of these build tools run when Wasmer starts.

The game code is AGPL-3.0-only. The separate asset submodule has file-specific notices and terms, including CC-BY-NC-SA, `LicenseRef-FAIR-USE`, and files with no recorded license/copyright information. The four no-reuse logos are replaced with transparent pixels; the no-reuse intro video is omitted. Keep `public/game-site/UPSTREAM_NOTICE.md`, `CREDITS.md`, `LICENSE.txt`, and `notices/` with the built assets. This is an unofficial deployment, not affiliated with PokeRogue or Nintendo. See [docs/upstream-contract.md](upstream-contract.md) for the pinned source and references.
