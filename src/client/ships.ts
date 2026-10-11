import Fuse from "fuse.js";
import type { Ship } from "../schema/output/ship.js";

export interface ShipsOptions {
  data: Record<string, Ship>;        // ships.json contents
  idMap: Record<string, string>;     // id-map.json contents
  fuseThreshold?: number;            // default 0.4
}

/** Optimal-string-alignment distance (Levenshtein + adjacent transposition). */
function editDistance(a: string, b: string): number {
  const rows = a.length + 1, cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
      }
    }
  }
  return d[rows - 1]![cols - 1]!;
}

/**
 * True when `query` is a prefix of one of the ship's names (3+ chars) or within
 * typo distance of one: 1 edit for 4-5 chars, 2 edits for 6+. Shorter queries
 * never fuzzy-match; they must hit an id or a name exactly.
 */
export function isCloseName(query: string, ship: Ship): boolean {
  const q = query.trim().toLowerCase();
  if (q.length < 3) return false;
  const maxEdits = q.length >= 6 ? 2 : q.length >= 4 ? 1 : 0;
  for (const raw of Object.values(ship.names)) {
    if (typeof raw !== "string") continue;
    const n = raw.toLowerCase();
    if (n.startsWith(q)) return true;
    if (maxEdits > 0 && Math.abs(n.length - q.length) <= maxEdits && editDistance(q, n) <= maxEdits) return true;
  }
  return false;
}

export class Ships {
  private readonly data: Record<string, Ship>;
  private readonly idMap: Record<string, string>;
  private readonly fuse: Fuse<Ship>;

  constructor(options: ShipsOptions) {
    this.data = options.data;
    this.idMap = options.idMap;
    this.fuse = new Fuse(Object.values(options.data), {
      keys: [
        { name: "names.en", weight: 3 },
        { name: "names.code", weight: 2 },
        { name: "names.jp", weight: 1 },
        { name: "names.cn", weight: 1 },
      ],
      threshold: options.fuseThreshold ?? 0.4,
      includeScore: true,
    });
  }

  // Primary getter. Accepts:
  //   - canonical group_type: "20212"
  //   - legacy 3-digit code: "115" (via idMap)
  //   - any name in idMap (case-insensitive)
  //   - fuzzy match via fuse.js
  get(nameOrId: string): Ship | undefined {
    if (typeof nameOrId !== "string" || nameOrId.length === 0) return undefined;

    // 1. Direct id hit
    if (this.data[nameOrId]) return this.data[nameOrId];

    // 2. Exact id-map hit (case sensitive first)
    const directId = this.idMap[nameOrId];
    if (directId && this.data[directId]) return this.data[directId];

    // 3. Case-insensitive id-map hit
    // Build a lowercased copy lazily
    const lower = nameOrId.toLowerCase();
    const ciIdMap = this.getCiIdMap();
    const ciId = ciIdMap[lower];
    if (ciId && this.data[ciId]) return this.data[ciId];

    // 4. Fuse.js fuzzy, but only for a typo-level edit distance or a name prefix.
    //    Fuse scores substrings as perfect matches ("22" -> U-522 at 0.000, "Kuon"
    //    -> Kronshtadt at 0.003), which a lookup must not return.
    const results = this.fuse.search(nameOrId, { limit: 1 });
    const hit = results[0];
    if (hit !== undefined && hit.score !== undefined && hit.score < 0.5 && isCloseName(nameOrId, hit.item)) {
      return hit.item;
    }
    return undefined;
  }

  private _ciIdMap?: Record<string, string>;
  private getCiIdMap(): Record<string, string> {
    if (!this._ciIdMap) {
      this._ciIdMap = {};
      for (const [k, v] of Object.entries(this.idMap)) {
        this._ciIdMap[k.toLowerCase()] = v;
      }
    }
    return this._ciIdMap;
  }

  getAll(): Ship[] {
    return Object.values(this.data);
  }

  getById(id: string): Ship | undefined {
    return this.data[id];
  }

  count(): number {
    return Object.keys(this.data).length;
  }

  // Search multiple matches
  search(query: string, limit = 10): Ship[] {
    const results = this.fuse.search(query, { limit });
    return results.map(r => r.item);
  }
}
