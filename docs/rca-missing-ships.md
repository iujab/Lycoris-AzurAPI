# RCA: missing ships and wrong nationalities (issue #2)

**Date:** 2026-10-10 · **Upstream snapshot:** AzurLaneTools/AzurLaneData `4cca5c24` (2026-05-08) · **Branch:** `fix/missing-ships`

The reporter listed 70 ships missing from `data/ships.json`, plus "Neptune" showing META instead of Royal Navy and the
Neptunia collab ships labeled META. Reproduced locally: `npm run build:data` on the snapshot yields 752 ships and all 70
are absent. The build is deterministic; CI was not at fault.

## Summary

| # | Cause | Ships affected | Status |
|---|---|---|---|
| 1 | `key.startsWith("9")` filter in `buildAllShips`/`buildShip` dropped every ship whose real limit-break rows live at 9-prefixed ids | 99 ships: 24 Vichya Dominion, 16 Tempesta, 59 META (40 of the 70 reported, plus "all META ships") | fixed |
| 2 | `NATIONALITY_MAP` wrong for 96/97/101, shifted by one for 105–112, missing 113–115 | 83 existing ships mislabeled; the 8 Neptunia ships shown as META | fixed |
| 3 | id-map used last-writer-wins, so collab/META ships overwrote core ships sharing a display name | `Enterprise`→HMS Enterprise, `Neptune`→Neptunia, `Fubuki`→Senran Kagura, `Kasumi`→Venus Vacation | fixed |
| 4 | 39 upstream names carry trailing whitespace (`"Foch "`, `"Le Malin μ "`), so exact and case-insensitive lookups miss | 39 ships | fixed |
| 5 | Upstream data repo has not been pushed since 2026-05-08 | 22 of the 70 (Hasty, Tiger, Bennington, U-2501, Z14/Z15, …) and 166 statistics rows added since | needs a new source |
| 6 | Only the EN template is enumerated | 8 of the 70 exist only in CN/JP (22, 33, the six Utawarerumono ships) | design decision |

After fixes 1–4: **851 ships**, exactly one per row of `ship_data_group.json`, nothing lost from the previous 752,
40 of the 70 reported ships present (the maximum this snapshot can yield), `ships.get("Neptune")` → HMS Neptune.

## Evidence

### 1. The 9-prefix filter

Limit-break rows are keyed `<group_type><lb digit 1-4>` (Belfast 20212 → 202121…202124). The filter's comment says
it skips "promo/alt forms", and it does hit those: the 331 rows in the `900xxx` block (900004 → Suffolk, 900465 →
Adventure Galley) are alt rows for ships that also have real LB rows. But three whole factions have their *real* rows at
9-prefixed ids:

| Prefix | Rows | Groups | What |
|---|---|---|---|
| 900xxx | 331 | 236 | alt/promo forms (correctly skipped) |
| 901xxx–907xxx, 999xxx | 96 | 24 | Vichya Dominion (Le Mars, Jean Bart, Dunkerque, Gascogne, …) |
| 960xxx | 64 | 16 | Tempesta (Royal Fortune, Golden Hind, Queen Anne's Revenge, …) |
| 970xxx–971xxx | 236 | 59 | META (Hunter.META, Fortune.META, …) |

The fix (`isLimitBreakRow` in `src/normalize/ship.ts`) keeps a row only when its key is the group_type followed by a
single LB digit. Measured on the snapshot: old rule → 752 groups, structural rule → 851 groups (= `ship_data_group`
row count), old ⊂ new, zero groups reachable only via rejected rows, and the 370 rejected rows are the 331 `900xxx`
alt rows plus 39 legacy-id rows of ships that also have proper rows.

Side effect: Kasumi (30181) has a legacy retrofit-form row `301534` ("Kasumi Retrofit") that the old filter admitted
and the LB-stage sort then picked as the base row, so she was emitted as "Kasumi Retrofit" with the retrofit skill
name and wiki URL. She now builds like every other retrofit ship (base name, `retrofit: true`, retrofit stats intact).

### 2. Nationality codes

Derived from `ship_data_group.nationality` joined to `ship_data_statistics.english_name` via the template rows:

| Code | Was | Is (ships in snapshot) |
|---|---|---|
| 96 | Universal | Tempesta (16) |
| 97 | Tempesta | META (59) |
| 98 | Universal | Universal — Bulins (3) |
| 101 | META | Neptunia (8) |
| 102 | Universal | Bilibili (CN only) |
| 103 | Universal | Utawarerumono (CN/JP only) |
| 104 | Universal | KizunaAI (4) |
| 105 | Neptunia | Hololive (7) |
| 106 | KizunaAI | Venus Vacation (15) |
| 107 | Hololive | The Idolmaster (7) |
| 108 | Venus Vacation | SSSS (9) |
| 109 | The Idolmaster | Atelier Ryza (6) |
| 110 | SSSS | Senran Kagura (7) |
| 111 | Atelier Ryza | To LOVE-Ru (6) |
| 112 | Senran Kagura | Black Rock Shooter (2) |
| 113 | — | Atelier Yumia (4) |
| 114 | — | DanMachi (2) |
| 115 | — | Date A Live (6) |

Codes 1–11 were correct. `tests/translate/enums.test.ts` pins every code.

### 3. Name collisions in the id map

Ships are emitted in ascending numeric id; core factions have 5-digit ids, META 6, collabs 7. With last-writer-wins
the collab always won. `buildIdMap` now uses first-writer-wins (and sorts defensively), so the core ship owns the bare
name and the other stays reachable via `names.code` (`HMS Enterprise`, `HDN Neptune`) or id. Covered by
`tests/output/idMap.test.ts`. Ships that lose a collision and have no distinct code name (Venus Vacation Kasumi,
Senran Kagura Fubuki) are reachable only by id or fuzzy search; an explicit alias is a possible follow-up.

### 4. Whitespace

`ship_data_statistics.name` / `english_name` have trailing spaces on 39 rows. `normalizeIdentity` now trims all four
names; the bulk-build test asserts no name has surrounding whitespace.

### 5. Sourcing

`AzurLaneTools/AzurLaneData` last push: 2026-05-08 (not archived, just dead). Every weekly refresh since then cloned
the same commit, and only the `generatedAt` timestamp changed. All 22 "nowhere" ships exist in current EN data
(9.3.384); none can be produced from this snapshot by any code change.

Candidates checked on 2026-10-10:

- **`AzurLaneTools/AzurLaneLuaScripts`** — same org, all five regions, updated daily (EN 9.3.384 / CN 9.7.395 / JP
  9.3.495 on 2026-10-10). Files are plain Lua table literals (`_G.pg.base.ship_data_template[100001] = { … }`), so
  the existing pipeline needs one Lua→JSON step in front of it. Most robust option; keeps CN/JP names.
- **`Fernando2603/AzurLaneData`** — EN only, JSON, tracks EN releases (9.3.384 on 2026-10-08). Covers all 23 files
  our ingest reads (`shop_template.json` sits under `sharecfg/` instead of `sharecfgdata/`). Extracted by key
  matching rather than full conversion, so new upstream fields can lag. Easiest drop-in, loses CN/JP names.
- `DongHaowen/AzurLaneData` fork — byte-identical to the dead upstream. `NavalHistorianAtLarge/AzurLaneData` — assets, not data.

Live EN data also introduces nationality codes **12** (Valparaíso and a "simulation" row) and **117** (NieR "A2");
both currently fall back to "Universal" and need names when the source moves.

### 6. EN-only enumeration

`buildAllShips` iterates the EN template only; CN/JP tables are loaded just for names. The identity layer already
carries an `isEnReleased` flag, so enumerating from the CN template with EN fallback is feasible, but it is a product
decision (the reporter's list came from the wiki, which includes CN-only ships).

## Guard added

`scripts/verify.ts` floor raised from 600 to 840 ships. The old floor let the 752-ship build pass for six months.

## Resolution of cause 5 (sourcing), 2026-10-10

Switched the data source to **AzurLaneTools/AzurLaneLuaScripts**. `scripts/lua2json.py` executes the Lua
config tables in a sandboxed `lupa` runtime and writes the same JSON layout under `upstream/azurlane-data`
that the ingest layer always read, so nothing downstream changed. The converter was validated by converting
the Lua repo at the commit matching the dead snapshot's EN version (9.2.557, 2026-04-23): all 23 tables came
out byte-for-byte identical to the AzurLaneData JSON. Three format quirks it handles: streamed tables split
into `sharecfg/<t>_sublist/*.lua` chunks assigned to `pg.base.<t>_N`, the older inline row format, and the
decompiler dropping the statement separator between consecutive `(function () … end)()` chunks (Lua parses
the second as a call on the first's nil result; a leading `;` restores the boundary).

Built on EN 9.3.384 / CN 9.7.395 / JP 9.3.495 (2026-10-10): **889 ships**, 62 of the 70 reported present;
the remaining 8 are CN/JP-only (cause 6). New faction codes named from the game's own list in
`sharecfgdata/gametip.lua`: 12 = Liga de Pedrería, 117 = NieR:Automata. Belfast gained a retrofit in live data,
so the snapshot-bound assertions in `tests/normalize/ship.test.ts` were relaxed.

Images: 44 of the 889 ships have no thumbnail and 67 skins no painting in `iujab/azurlane-images`, all added
since 2026-07. That repo's weekly refresh has succeeded without adding anything since then because its pinned
`azlassets==3.5` cannot parse bundles with stripped Unity version strings (648 failures per run); the fix is
the upgrade on its `fix/azlassets-upgrade` branch.
