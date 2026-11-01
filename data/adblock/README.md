# Offline advertising protection

Yoru uses the unmodified **@ghostery/adblocker 2.20.3**, MPL-2.0. The engine is compiled from EasyList, EasyPrivacy, uBlock Origin filters/unbreak/quick fixes and RU AdList, plus the separately identified Yoru player additions.

Attribution and original notices remain in `sources/`. EasyList/EasyPrivacy offer GPL-3.0 or CC-BY-SA-3.0; uBlock Origin filters/resources use GPL-3.0; RU AdList's header credits its authors under CC-BY-3.0 (additional included contributions retain their notices). Ghostery's MPL and uAssets' GPL text are included. These terms apply to the corresponding components and data.

`provenance.json` records immutable upstream commits, source URLs and SHA-256 values. Every original filter input and the resource bundle is distributed next to the compiled engine. Yoru additions are in `player-filters.txt`; they are also available under GPL-3.0-or-later for combination with the bundled data. No subscription server, account or runtime list download is needed. Generated data and its source are published with Yoru at https://github.com/Duwkaf1/kinoteatr-xivivide/tree/main/data/adblock .

Rebuild with `node scripts/update-adblock.js --offline`. Maintainer refresh: `NODE_USE_ENV_PROXY=1 node scripts/update-adblock.js`, then review provenance, rules and tests. HTTPS/checksum validation remains enabled.

The local `yoru-adblock` protocol serves only registered immutable compatibility resources from the filter engine. It has no filesystem, shell, network proxy or application IPC access. This lets a player receive an empty valid VAST response or advertising-SDK shim without waiting on a blocked advertisement. Popup creation is denied. Burned-in advertising in the actual film/anime file cannot be removed by a request blocker.
