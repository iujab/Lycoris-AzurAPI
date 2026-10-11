import type { StatBlock } from "../schema/output/ship.js";

// ---------------------------------------------------------------------------
// Rarity
// ---------------------------------------------------------------------------

/** Maps integer rarity → AzurAPI rarity string */
export const RARITY_MAP: Record<number, "Normal" | "Rare" | "Elite" | "Super Rare" | "Ultra Rare"> = {
  1: "Normal",
  2: "Normal",
  3: "Rare",
  4: "Elite",
  5: "Super Rare",
  6: "Ultra Rare",
};

/**
 * Resolve a rarity integer to its display string.
 *
 * Research ships are keyed off the raw `rarity` value, not `blueprint_version`:
 *   - rarity === 5 && isResearch → "Priority"
 *   - rarity === 6 && isResearch → "Decisive"
 *   - else                       → RARITY_MAP[rarity] ?? "Normal"
 */
export function rarityName(rarity: number, isResearch: boolean): string {
  if (isResearch) {
    if (rarity === 5) return "Priority";
    if (rarity === 6) return "Decisive";
  }
  return RARITY_MAP[rarity] ?? "Normal";
}

// ---------------------------------------------------------------------------
// Nationality
// ---------------------------------------------------------------------------

/**
 * Nationality int → display string. Matches Azur Lane wiki convention.
 *
 * Codes verified against upstream ship_data_group.json + ship_data_statistics.json
 * (AzurLaneTools/AzurLaneData 4cca5c24, 2026-05-08) and the game's own faction list in
 * sharecfgdata/gametip.lua (EN 9.3.384); see tests/translate/enums.test.ts.
 * Each collab has its own code from 101 upward, in release order.
 */
export const NATIONALITY_MAP: Record<number, string> = {
  0: "Universal",
  1: "Eagle Union",
  2: "Royal Navy",
  3: "Sakura Empire",
  4: "Iron Blood",
  5: "Dragon Empery",
  6: "Sardegna Empire",
  7: "Northern Parliament",
  8: "Iris Libre",
  9: "Vichya Dominion",
  10: "Iris Orthodoxy",
  11: "Kingdom of Tulipa",
  12: "Liga de Pedrería",     // Valparaíso (new faction, EN 9.3.384)
  96: "Tempesta",            // MOT Royal Fortune, Golden Hind, ...
  97: "META",                // Hunter.META, Fortune.META, ...
  98: "Universal",           // Bulins
  101: "Neptunia",           // HDN Neptune, Noire, Blanc, ...
  102: "Bilibili",           // 22, 33 (CN only)
  103: "Utawarerumono",      // Kuon, Nekone, Rurutie, ... (CN/JP only)
  104: "KizunaAI",
  105: "Hololive",           // Shirakami Fubuki, Tokino Sora, ...
  106: "Venus Vacation",     // Marie Rose, Honoka, ...
  107: "The Idolmaster",     // Haruka Amami, ...
  108: "SSSS",               // Rikka Takarada, ...
  109: "Atelier Ryza",       // Reisalin Stout, ...
  110: "Senran Kagura",      // Asuka, Ikaruga, ...
  111: "To LOVE-Ru",         // Lala Satalin Deviluke, ...
  112: "Black Rock Shooter", // BLACK★ROCK SHOOTER, DEAD MASTER
  113: "Atelier Yumia",      // Yumia Liessfeldt, ...
  114: "DanMachi",           // Hestia, Ryu Lion
  115: "Date A Live",        // Tohka Yatogami, ...
  117: "NieR:Automata",       // A2, 2B (EN 9.3.384)
};

/** Look up a nationality code; falls back to "Universal". */
export function nationalityName(code: number): string {
  return NATIONALITY_MAP[code] ?? "Universal";
}

// ---------------------------------------------------------------------------
// Skill color
// ---------------------------------------------------------------------------

/**
 * Skill type int → Azur Lane in-client border color.
 *
 *   1 = offensive → "red"
 *   2 = defensive → "blue"
 *   3 = support   → "yellow"
 *   0 = unset / placeholder (legacy passives like "Repair I") → "blue"
 *
 * NOTE: this corrects a long-standing AzurAPI mislabeling where the map read
 *   1 → "yellow", 2 → "pink", 3 → "blue"
 * — the game type numbers had been bound to the wrong category names, and
 * the "pink" sentinel was invented to paper over type 2. Consumers relying
 * on the old labels will now see the in-game colors instead.
 */
export const SKILL_COLOR_MAP: Record<number, "red" | "yellow" | "blue"> = {
  0: "blue",
  1: "red",
  2: "blue",
  3: "yellow",
};

/** Look up a skill type color; falls back to "blue" for unknown types. */
export function skillColor(type: number): "red" | "yellow" | "blue" {
  return SKILL_COLOR_MAP[type] ?? "blue";
}

// ---------------------------------------------------------------------------
// Stat index map
// ---------------------------------------------------------------------------

/**
 * Stat index (0..11) → AzurAPI stat field name (on StatBlock).
 * Only the 10 exposed stats. armor (6) and antisub (11) are intentionally missing.
 */
export const STAT_INDEX_TO_FIELD: Record<number, keyof StatBlock | undefined> = {
  0: "health",
  1: "firepower",
  2: "torpedo",
  3: "antiwar",   // AA — keep AzurAPI typo
  4: "aviation",
  5: "reload",
  6: undefined,   // armor — not in StatBlock
  7: "accuracy",
  8: "evasion",
  9: "speed",
  10: "luck",
  11: undefined,  // antisub — not in StatBlock
};

// ---------------------------------------------------------------------------
// Fleet-tech stat map
// ---------------------------------------------------------------------------

/**
 * Fleet-tech attribute id → display name.
 * From attribute_info_by_type.json, but hard-coded to avoid a data lookup per ship.
 */
export const FLEET_TECH_STAT_MAP: Record<number, string> = {
  1: "health",
  2: "firepower",
  3: "torpedo",
  4: "antiaircraft",
  5: "aviation",
  6: "reload",
  7: "armor",
  8: "accuracy",
  9: "evasion",
  10: "speed",
  11: "luck",
  12: "antisub",
};
