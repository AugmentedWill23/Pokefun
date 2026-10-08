PokeRogue runtime fix — changed files only

Copy/merge these files over the same paths in your existing project:
- server.mjs
- package.json, package-lock.json, .node-version
- public/index.html

The wrapper now opens the locally served game at /game-site/ in a full-viewport iframe, and server.mjs proxies the account/API paths through the same origin. This removes the cross-origin wrapper and avoids showing upstream Cloudflare challenge HTML as the game.

Important: this is an incremental patch, not a standalone app. The existing project must already contain the complete built game client under public/game-site/ (including its index.html and assets). This small patch intentionally excludes that large folder. If public/game-site/ is missing, these files alone cannot display the game.

For Render, use Node 24, install with `npm ci`, start with `npm start`, and set the health check path to `/_health`. Keep the existing game assets and attribution/notice files in place.
