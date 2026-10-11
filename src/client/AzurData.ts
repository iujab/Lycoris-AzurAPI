import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Ships } from "./ships.js";
import { fetchLatestData, type FetchOptions } from "./fetcher.js";
import type { Ship } from "../schema/output/ship.js";

export interface AzurDataOptions {
  dataPath?: string;
}

export interface AzurDataInitOptions extends FetchOptions {
  /** Fetch latest data from GitHub on startup. Default: true */
  fetchLatest?: boolean;
}

/**
 * Path of this source file as seen in a stack trace: a file:// URL under ESM,
 * a plain path under CJS. This file is compiled to both formats from one
 * source, so `import.meta.url` cannot be written here (it is a syntax error
 * in the CJS build), and `__dirname` only exists in CJS.
 */
function thisFileFromStack(): string | undefined {
  const stack = new Error().stack ?? "";
  for (const line of stack.split("\n").slice(1)) {
    const m = line.match(/\(?((?:file:\/\/)?\/[^):]+?\.[cm]?[jt]s):\d+:\d+\)?$/);
    if (m?.[1] !== undefined) return m[1].startsWith("file://") ? fileURLToPath(m[1]) : m[1];
  }
  return undefined;
}

function resolveThisDir(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore __dirname exists in CJS but not in ESM type defs
    if (typeof __dirname === "string") return __dirname; // eslint-disable-line no-undef
  } catch { /* not CJS */ }
  const file = thisFileFromStack();
  if (file !== undefined) return path.dirname(file);
  return process.cwd(); // last resort; resolveDefaultDataPath walks up from here
}

export class AzurData {
  readonly ships: Ships;

  /** Sync constructor — loads baked data from disk. No network. */
  constructor(options: AzurDataOptions = {}) {
    const dataDir = options.dataPath ?? AzurData.resolveDefaultDataPath();
    const shipsJson = JSON.parse(
      fs.readFileSync(path.join(dataDir, "ships.json"), "utf8"),
    ) as Record<string, Ship>;
    const idMapJson = JSON.parse(
      fs.readFileSync(path.join(dataDir, "id-map.json"), "utf8"),
    ) as Record<string, string>;
    this.ships = new Ships({ data: shipsJson, idMap: idMapJson });
  }

  /**
   * Async factory — fetches latest data from GitHub, caches locally,
   * falls back to baked data if offline.
   *
   * ```ts
   * const azur = await AzurData.init({ fetchLatest: true });
   * ```
   */
  static async init(options: AzurDataInitOptions = {}): Promise<AzurData> {
    const { fetchLatest = true, ...fetchOpts } = options;

    if (fetchLatest) {
      const fetched = await fetchLatestData(fetchOpts);
      if (fetched) {
        const instance = Object.create(AzurData.prototype) as AzurData;
        (instance as { ships: Ships }).ships = new Ships({
          data: fetched.ships,
          idMap: fetched.idMap,
        });
        return instance;
      }
    }

    // Fallback to baked data
    return new AzurData();
  }

  private static resolveDefaultDataPath(): string {
    const thisDir = resolveThisDir();
    let candidate = thisDir;
    for (let i = 0; i < 5; i++) {
      const dataPath = path.resolve(candidate, "data");
      if (fs.existsSync(path.join(dataPath, "ships.json"))) return dataPath;
      candidate = path.resolve(candidate, "..");
    }
    return path.resolve(process.cwd(), "data");
  }
}
