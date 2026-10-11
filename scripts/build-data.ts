#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";
import { createBuildContext, buildAllShips } from "../src/normalize/ship.js";
import {
  writeShips,
  writeShipList,
  writeIdMap,
  writeVersion,
} from "../src/output/index.js";

function scanAvailablePaintings(): Set<string> {
  const imagesDir = path.resolve(process.cwd(), "../azurlane-images/paintings");
  const set = new Set<string>();
  if (!fs.existsSync(imagesDir)) {
    console.warn("azurapi build-data: images dir not found, skin variants will be empty");
    return set;
  }
  for (const file of fs.readdirSync(imagesDir)) {
    if (file.endsWith(".webp")) {
      set.add(file.slice(0, -5).toLowerCase());
    }
  }
  console.log(`azurapi build-data: found ${set.size} painting files for variant lookup`);
  return set;
}

function scanAvailableThumbnails(): Map<string, string> {
  const dir = path.resolve(process.cwd(), "../azurlane-images/thumbnails");
  const map = new Map<string, string>();
  if (!fs.existsSync(dir)) {
    console.warn("azurapi build-data: thumbnails dir not found, thumbnails default to <group id>.png");
    return map;
  }
  for (const file of fs.readdirSync(dir)) {
    if (file.endsWith(".png")) {
      const stem = file.slice(0, -4);
      map.set(stem.toLowerCase(), stem);
    }
  }
  console.log(`azurapi build-data: found ${map.size} thumbnail files for lookup`);
  return map;
}

async function main(): Promise<void> {
  console.log("azurapi build-data: loading raw upstream (EN + CN + JP)...");

  const ctx = await createBuildContext({ loadCn: true, loadJp: true });
  ctx.availablePaintings = scanAvailablePaintings();
  const thumbs = scanAvailableThumbnails();
  if (thumbs.size > 0) ctx.availableThumbnails = thumbs;

  console.log("azurapi build-data: building ships...");
  const start = Date.now();
  const ships = buildAllShips(ctx);
  const elapsed = Date.now() - start;
  console.log(`azurapi build-data: built ${ships.length} ships in ${elapsed}ms`);

  // Extract group rows for the id map
  const groupRows: Array<{ code: number; group_type: number }> = Object.values(ctx.en.group)
    .filter((g): g is NonNullable<typeof g> => g !== undefined)
    .map((g) => ({ code: g.code, group_type: g.group_type }));

  writeShips(ships);
  writeShipList(ships);
  writeIdMap(ships, groupRows);
  writeVersion(ships.length);

  console.log(
    "azurapi build-data: wrote data/ships.json, ship-list.json, id-map.json, version.json",
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
