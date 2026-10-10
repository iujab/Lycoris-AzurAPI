<img src="https://github.com/iujab/azurlane-images/blob/main/banner.png" />

# LycorisTech/AzurAPI

<p align="center">
  <a href="https://www.npmjs.com/package/@lycoristech/azurapi"><img alt="npm version" src="https://img.shields.io/npm/v/%40lycoristech%2Fazurapi?logo=npm&logoColor=white&label=npm" /></a>
  <a href="https://www.npmjs.com/package/@lycoristech/azurapi"><img alt="npm total downloads" src="https://img.shields.io/npm/d18m/%40lycoristech%2Fazurapi?label=downloads" /></a>
</p>

A self-maintained, current Azur Lane data library. Drop-in replacement for the `@azurapi/azurapi` package.

## Why?

The older and amazing `@azurapi/azurapi` ecosystem is now 3+ years stale. I have fond memories starting off my computer science hobby building a discord bot using that API. Recently, when revisiting my old discord bot, I noticed that the azurapi package was years out of date, likely due to the wiki scraper method no longer being viable. This AzurAPI builds on the [AzurLaneTools/AzurLaneData](https://github.com/AzurLaneTools/AzurLaneData) and [nobbyfix/AzurLane-AssetDownloader](https://github.com/nobbyfix/AzurLane-AssetDownloader) repos so our data stays fresh within hours of each game patch.

## Installation

```bash
npm install @lycoristech/azurapi
```

## Usage

```ts
import { AzurData } from "@lycoristech/azurapi";

const azur = new AzurData();

// Get a ship by name, ID, or fuzzy search
const belfast = azur.ships.get("Belfast");
const byId    = azur.ships.get("20212");
const byCode  = azur.ships.get("115");

// Get all ships
const all = azur.ships.getAll();
console.log(`${azur.ships.count()} ships loaded`);

// Fuzzy search
const results = azur.ships.search("Enterp", 5); // top 5 matches
```

## Migrating from @azurapi/azurapi

```diff
- import { AzurAPI } from "@azurapi/azurapi";
+ import { AzurData as AzurAPI } from "@lycoristech/azurapi";
```

That's it. The `ships.get()` API is compatible. Ship objects match the same schema!

### Relationship to the original AzurAPI project

This library is a **schema-compatible successor** to [`@azurapi/azurapi`](https://github.com/AzurAPI/azurapi-js) (GPL-3.0) and its sister data repo [`AzurAPI/azurapi-js-setup`](https://github.com/AzurAPI/azurapi-js-setup) (AGPL-3.0).

This project is not a fork and does not contain any code from those repositories. It is an independent rewrite built from scratch against the decompiled game data from [AzurLaneTools/AzurLaneData](https://github.com/AzurLaneTools/AzurLaneData).

The output JSON schema (field names, structure, rarity values, etc.) is deliberately kept shape-compatible with the original so existing devs can migrate with a single import change.

## Data Freshness

Data is auto-refreshed weekly (every Monday) via GitHub Actions from [AzurLaneTools/AzurLaneData](https://github.com/AzurLaneTools/AzurLaneData) (EN + CN + JP regions). The refresh pipeline:
1. Sparse-clones the upstream repo
2. Normalizes raw game tables into AzurAPI-compatible JSON
3. Runs sanity checks (schema validation, field coverage)
4. Commits updated `data/*.json` only if data changed

You can also trigger a refresh manually from the Actions tab, or run `npm run build:data` locally.

Current data version: see [`data/version.json`](data/version.json).

## Ship Schema

Ships have the full AzurAPI-compatible shape including:
- Identity: `id`, `names`, `rarity`, `class`, `hullType`, `nationality`
- Stats: level 100/120, with and without retrofit
- Equipment slots with min/max efficiency
- Skills with max-rank substituted descriptions
- Limit breaks, construction info, fleet tech
- Skins with metadata
- And more — see [`src/schema/output/ship.ts`](src/schema/output/ship.ts)

## Raw JSON Access

The committed `data/ships.json` is fetchable via GitHub raw URL:

```
https://raw.githubusercontent.com/iujab/Lycoris-AzurAPI/main/data/ships.json
```

Also available: `ship-list.json` (minimal index), `id-map.json` (name→id lookup), `version.json`.

## Development

```bash
# Install deps
npm install

# Build data from upstream (requires upstream/ sparse checkout)
npm run build:data

# Verify data integrity
npm run verify

# Run tests
npm test

# Type check
npm run typecheck
```

## Asset Images

Ship paintings and thumbnails are hosted in a separate GitHub repo: [iujab/azurlane-images](https://github.com/iujab/azurlane-images). Image URLs in ship data point to raw GitHub URLs from that repo:

- **Paintings** — skin art in WebP format (`paintings/{asset_name}.webp`)
- **Thumbnails** — shipyard icons in PNG format (`thumbnails/{group_type}.png`)

## License and Rights

This software is licensed under the **GNU General Public License v3.0** — see [LICENSE](LICENSE).

This is an **unofficial, non-commercial, community-maintained fan project**. It is not developed, endorsed, sponsored, or in any way affiliated with Manjuu, Yongshi, Yostar, or any of their subsidiaries.

## Acknowledgments

- [AzurLaneTools/AzurLaneData](https://github.com/AzurLaneTools/AzurLaneData) — upstream auto-updating game data
- [nobbyfix/AzurLane-AssetDownloader](https://github.com/nobbyfix/AzurLane-AssetDownloader) — game asset extraction
- [AzurAPI/azurapi-js](https://github.com/AzurAPI/azurapi-js) — the original library whose schema we replicate, and the base inspiration for this project!❤️
