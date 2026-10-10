#!/usr/bin/env tsx
import fs from "node:fs";
import { ShipSchema, IdMapSchema } from "../src/schema/output/ship.js";

// Safety floor. ship_data_group has 851 rows in upstream snapshot 4cca5c24 and the
// build must emit one ship per row; the old floor of 600 let a 752-ship build
// (99 ships silently dropped) pass for months. See docs/rca-missing-ships.md.
const MIN_SHIP_COUNT = 840;

function fail(msg: string): never {
  console.error("VERIFY FAIL:", msg);
  process.exit(1);
}

function pass(msg: string): void {
  console.log("  \u2713", msg);
}

function main(): void {
  // 1. Existence checks
  for (const f of [
    "data/ships.json",
    "data/ship-list.json",
    "data/id-map.json",
    "data/version.json",
  ]) {
    if (!fs.existsSync(f)) fail(`${f} does not exist`);
    pass(`${f} exists`);
  }

  // 2. Parse ships.json and validate schema
  const shipsRaw: unknown = JSON.parse(fs.readFileSync("data/ships.json", "utf8"));
  if (typeof shipsRaw !== "object" || shipsRaw === null || Array.isArray(shipsRaw)) {
    fail("ships.json is not a dict");
  }
  const shipsDict = shipsRaw as Record<string, unknown>;
  const shipCount = Object.keys(shipsDict).length;
  if (shipCount < MIN_SHIP_COUNT) {
    fail(`ships.json has only ${shipCount} ships; expected at least ${MIN_SHIP_COUNT}`);
  }
  pass(`ships.json has ${shipCount} ships`);

  // Validate a sample of 20 against ShipSchema
  const keys = Object.keys(shipsDict);
  let validated = 0;
  for (const k of keys.slice(0, 20)) {
    const ship = shipsDict[k];
    try {
      ShipSchema.parse(ship);
      validated++;
    } catch (e) {
      fail(`ships.json ship "${k}" failed schema: ${(e as Error).message}`);
    }
  }
  pass(`validated ${validated}/20 sample ships against ShipSchema`);

  // 3. Specific ships that must be present (non-blocking if missing)
  const requiredShips = ["20212" /* Belfast */];
  for (const groupType of requiredShips) {
    if (!(groupType in shipsDict)) {
      console.warn(`  ! expected ship ${groupType} missing (non-blocking)`);
    } else {
      pass(`ship ${groupType} present`);
    }
  }

  // 4. Parse and validate id-map.json
  const idMapRaw: unknown = JSON.parse(fs.readFileSync("data/id-map.json", "utf8"));
  IdMapSchema.parse(idMapRaw);
  pass(`id-map.json valid (${Object.keys(idMapRaw as object).length} entries)`);

  // 5. Check that "Belfast" resolves via id-map
  const belfastId = (idMapRaw as Record<string, string>)["Belfast"];
  if (belfastId === undefined) {
    console.warn("  ! 'Belfast' not in id-map (non-blocking)");
  } else {
    pass(`'Belfast' in id-map \u2192 ${belfastId}`);
  }

  // 6. Spot check: every ship has minimal required fields
  let missingFields = 0;
  for (const [k, raw] of Object.entries(shipsDict)) {
    const ship = raw as Record<string, unknown>;
    if (!ship["id"] || !ship["rarity"] || !ship["hullType"] || !ship["nationality"]) {
      missingFields++;
      if (missingFields <= 5) {
        console.warn(`  ! ship ${k} missing required scalar fields`);
      }
    }
  }
  if (missingFields > 0) {
    fail(`${missingFields} ships missing required scalar fields`);
  }
  pass("all ships have required scalar fields");

  // 7. ship-list.json sanity
  const shipList: unknown = JSON.parse(fs.readFileSync("data/ship-list.json", "utf8"));
  if (!Array.isArray(shipList)) fail("ship-list.json is not an array");
  if ((shipList as unknown[]).length !== shipCount) {
    fail(
      `ship-list.json has ${(shipList as unknown[]).length} entries, ships.json has ${shipCount}`,
    );
  }
  pass(`ship-list.json has ${(shipList as unknown[]).length} entries (matches ships.json)`);

  // 8. version.json sanity
  const version = JSON.parse(fs.readFileSync("data/version.json", "utf8")) as Record<
    string,
    unknown
  >;
  if (!version["shipCount"] || !version["generatedAt"]) {
    fail("version.json missing fields");
  }
  if (version["shipCount"] !== shipCount) {
    fail(`version.json shipCount ${String(version["shipCount"])} \u2260 ships.json ${shipCount}`);
  }
  pass(`version.json: shipCount ${String(version["shipCount"])}, generatedAt ${String(version["generatedAt"])}`);

  console.log("VERIFY: all checks passed");
}

main();
