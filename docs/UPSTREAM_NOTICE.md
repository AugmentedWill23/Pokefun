# Upstream source and asset notice

This is an unofficial deployment of the PokeRogue browser game and is not affiliated with Pagefault Games, Nintendo, The Pokémon Company, Game Freak, or Creatures Inc.

## Game code

The client was built from [pagefaultgames/pokerogue](https://github.com/pagefaultgames/pokerogue) beta revision [`2e2f53958ed4080947abf4ab4c3fa8fe1919c6d1`](https://github.com/pagefaultgames/pokerogue/tree/2e2f53958ed4080947abf4ab4c3fa8fe1919c6d1). The upstream code is marked **AGPL-3.0-only** unless otherwise noted. The original license and credits are available in [`LICENSE.txt`](./LICENSE.txt) and [`CREDITS.md`](./CREDITS.md); the corresponding source is linked above. The only source patch in this distribution removes the no-reuse intro video and makes the ordinary progress screen visible instead; see the deployment source bundle's `docs/patches/remove-no-reuse-intro.patch`.

## Assets and locales

The game assets are from [pagefaultgames/pokerogue-assets](https://github.com/pagefaultgames/pokerogue-assets/tree/9378069914157ea599308ef53ff972459276d3e8) revision `9378069914157ea599308ef53ff972459276d3e8`; locales are from [pagefaultgames/pokerogue-locales](https://github.com/pagefaultgames/pokerogue-locales/tree/0696f674f631b47f208f5d687b427ed3e7cd81b0) revision `0696f674f631b47f208f5d687b427ed3e7cd81b0`. Asset rights are separate from the game-code license. Retained upstream notices are in [`CREDITS.md`](./CREDITS.md), [`notices/`](./notices/), and the upstream repositories. The asset repository describes applicable material as CC-BY-NC-SA-4.0 only where eligible and explicitly identifies some Pokémon-related artwork/audio as `LicenseRef-FAIR-USE`; it also warns that some files have no recorded licensing/copyright information. Review the file-specific notices and obtain any permissions required for your use; this notice is not legal advice.

The four upstream project-logo paths identified by the asset repository as `LicenseRef-NO-REUSE` are replaced with **transparent 1×1 PNG placeholders**. No proxy badge or replacement logo is rendered over the game. The `images/intro_dark.mp4` no-reuse intro video is omitted. Other upstream art, audio, and data remain subject to their own notices and limitations; do not infer blanket redistribution permission from the AGPL license.

## Service behavior

The browser client is hosted from this application. Account, game, save, daily, authentication, and admin requests are forwarded to PokeRogue's official API by the Node proxy. The proxy operator can technically observe traffic that passes through its server; this deployment does not claim to be an official PokeRogue service. Sign-in and licensing details are kept in this notice and the project README, not in a gameplay overlay.
