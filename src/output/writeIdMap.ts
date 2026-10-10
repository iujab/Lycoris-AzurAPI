import fs from "fs";
import path from "path";
import type { Ship } from "../schema/output/ship.js";
import type { IdMap } from "../schema/output/ship.js";

// ---------------------------------------------------------------------------
// writeIdMap
// ---------------------------------------------------------------------------

/**
 * Build the name/alias → canonical id map.
 *
 * Shape: Record<string, string>
 *
 * For each ship: emits names.en → id, names.cn → id, names.jp → id, names.code → id
 * For each groupRow: emits padded code → group_type string (legacy AzurAPI lookup)
 *
 * Collisions: first-writer-wins, with ships visited in ascending numeric id order.
 * Core factions have 5-digit ids, META 6-digit (97xxxx) and collabs 7-digit, so a
 * shared display name resolves to the core-faction ship: "Enterprise" → USS
 * Enterprise (10706) not HMS Enterprise (20232), "Neptune" → HMS Neptune (29901)
 * not the Neptunia collab (1010001), likewise Fubuki and Kasumi. The other ship
 * stays reachable through its names.code ("HMS Enterprise", "HDN Neptune", ...)
 * or its id. Code names never shadow another ship's display name.
 */
export function buildIdMap(
  ships: Ship[],
  groupRows: Array<{ code: number; group_type: number }>,
): IdMap {
  const map: IdMap = {};
  const ordered = [...ships].sort((a, b) => Number(a.id) - Number(b.id));

  // Collect all EN names first so we don't let names.code overwrite a real ship name
  const enNames = new Set<string>();
  for (const ship of ordered) {
    if (ship.names.en !== undefined) enNames.add(ship.names.en);
  }

  for (const ship of ordered) {
    const { id, names } = ship;
    if (names.en !== undefined && !(names.en in map)) map[names.en] = id;
    if (names.cn !== undefined && !(names.cn in map)) map[names.cn] = id;
    if (names.jp !== undefined && !(names.jp in map)) map[names.jp] = id;
    if (names.code !== undefined && !(names.code in map) && !enNames.has(names.code)) {
      map[names.code] = id;
    }
  }

  // Legacy 3-digit code → group_type mapping from groupRows
  for (const row of groupRows) {
    const paddedCode = String(row.code).padStart(3, "0");
    map[paddedCode] = String(row.group_type);
  }

  return map;
}

/** Write the id map (see buildIdMap) to disk. */
export function writeIdMap(
  ships: Ship[],
  groupRows: Array<{ code: number; group_type: number }>,
  outputPath = "data/id-map.json",
): void {
  const json = JSON.stringify(buildIdMap(ships, groupRows), null, 2);

  const dir = path.dirname(path.resolve(outputPath));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, json, "utf-8");
}
