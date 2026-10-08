# PokeRogue portal (unofficial)

This project serves a locally built PokeRogue beta client from `public/game-site/` inside a full-viewport shell. The Node server proxies only the official account/game API paths. It does not fetch the `pokerogue.net/` HTML that was returning a Cloudflare challenge and leaving the deployed game blank.

The gameplay view is **edge-to-edge with no proxy badge, blue dot, or other overlay**. The four upstream project-logo paths marked no-reuse are replaced with transparent placeholders, so the proxy does not put its own mark over the game's login or loading screen.

## What to do with `server.mjs`

`server.mjs` is the backend server and API proxy. Do not paste it into an HTML editor or open it as a web page. Upload it at the root of the Wasmer Node application beside `package.json` and the `public/` directory. If the dashboard asks for a start command, use `npm start`. The server serves the wrapper and local game files, then forwards the official account API paths through the same host. It listens on `0.0.0.0` and honors Wasmer's `PORT` (default `8080`). The package requires Node `>=24.9.0` and has no runtime npm dependencies.

## Wasmer dashboard upload

Download and extract `pokerogueaug-wasmer-upload.zip`, then upload the archive's **contents** so `package.json`, `package-lock.json`, `server.mjs`, and `public/` sit at the application root. Include the complete `public/game-site/` tree; it is about **737 MB unpacked**. Choose a Node application, not static-only hosting, and trigger a new deploy in the Wasmer dashboard. This source handoff does not update the already-running Wasmer app by itself. The detailed upload and post-deploy checks are in [docs/wasmer-deployment.md](docs/wasmer-deployment.md).

The app is host-agnostic and can run at `https://pokerogueaug.wasmer.app` once that deployment uses these files. If it still shows the old blank page after redeploy, hard-refresh or clear the host's cached site data. Check that `/game-site/asset-manifest.json` and the JavaScript file it names return nonempty responses.

## Sign-in and saves

Username/password account calls go through this site's same-origin proxy to PokeRogue's official API. The proxy does not log or persist request bodies, credentials, or account tokens, but traffic necessarily passes through the server operator; use only an instance you trust. Google/Discord OAuth callbacks are registered by PokeRogue and may return to `pokerogue.net`. Browser-local saves are scoped to the current hostname; official account/cloud saves remain on PokeRogue's service. An unauthenticated `GET /account/info` returning `401 missing token` is expected and is not a login test. The sign-in and asset caveats are documented here rather than displayed over the game.

## Upstream source and asset terms

The client build is pinned to upstream beta source, asset, and locale revisions documented in [docs/upstream-contract.md](docs/upstream-contract.md). Game code is AGPL-3.0-only unless otherwise noted. Asset rights are separate and vary by file; upstream marks some content as fair-use and warns that some files have no recorded license/copyright information. Four upstream logo paths marked no-reuse are **replaced with transparent placeholders**, and the no-reuse intro movie was omitted. Preserve the bundled `UPSTREAM_NOTICE.md`, `CREDITS.md`, and `notices/`, and review the file-specific terms for your intended use. This is not an official PokeRogue or Nintendo deployment.
