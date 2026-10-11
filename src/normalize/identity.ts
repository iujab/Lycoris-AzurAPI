import type { Ship } from "../schema/output/ship.js";
import { THUMBNAILS_URL } from "../config.js";
import type {
  ShipDataTemplate,
  ShipDataStatistics,
  ShipDataGroup,
  ShipDataBlueprint,
  FleetTechShipTemplate,
  FleetTechShipClass,
  ShipDataByType,
  ShipDataGroupValue,
  ShipSkinTemplate,
} from "../schema/raw/index.js";
import type { Lookups } from "../translate/lookups.js";
import { rarityName, nationalityName } from "../translate/enums.js";
import { starsString, wikiUrlFor } from "../translate/strings.js";

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export interface IdentityInputs {
  groupType: string;
  /** The LB0..LB3 row IDs for this group. Primary row is the max-LB one (suffix 4). */
  rowIds: string[];
  en: {
    template: ShipDataTemplate;
    statistics: ShipDataStatistics;
    group: ShipDataGroup;
    blueprint: ShipDataBlueprint;
    fleetTechShipTemplate: FleetTechShipTemplate;
    fleetTechShipClass: FleetTechShipClass;
    shipDataByType: ShipDataByType;
    /** Needed to resolve the thumbnail by the default skin's painting name. */
    skinTemplate?: ShipSkinTemplate;
  };
  /**
   * Thumbnail files present in the images repo: lowercase stem -> actual filename stem.
   * When given, the thumbnail URL only points at a file that exists (see resolveThumbnail).
   */
  availableThumbnails?: Map<string, string>;
  cn?: {
    statistics: ShipDataStatistics;
  };
  jp?: {
    statistics: ShipDataStatistics;
  };
  /** Caller determines whether the group exists in EN. */
  isEnReleased: boolean;
  /** Whether this ship belongs to the research/blueprint category. */
  isResearch: boolean;
  /** Pre-resolved group row from ship_data_group (caller looks up by group_type). */
  groupRow: ShipDataGroupValue;
  /** Lookups helper for class/hull/equip name resolution. */
  lookups: Lookups;
}

export interface IdentityOutput {
  id: string;
  names: Ship["names"];
  rarity: Ship["rarity"];
  stars: Ship["stars"];
  class: string;
  hullType: string;
  nationality: string;
  wikiUrl?: string;
  thumbnail: string;
  isEnReleased?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true if the string contains any CJK Unified Ideograph. */
function isLikelyChinese(s: string): boolean {
  return /[\u4e00-\u9fff]/.test(s);
}

/**
 * Pick the thumbnail filename stem for a ship.
 *
 * Shipyard icons in azurlane-images are named after the texture inside the
 * bundle: historically the numeric group id (20212.png), but newer bundles use
 * the skin's painting name (weikesibao.png, z14.png, 2B.png). Prefer the id so
 * existing URLs stay stable, fall back to the default skin's painting name, and
 * keep the id when nothing is known (no images clone at build time).
 */
export function resolveThumbnail(
  groupType: string,
  defaultPainting: string | undefined,
  available: Map<string, string> | undefined,
): string {
  if (available === undefined) return groupType;
  const byId = available.get(groupType.toLowerCase());
  if (byId !== undefined) return byId;
  if (defaultPainting !== undefined) {
    const byPainting = available.get(defaultPainting.toLowerCase());
    if (byPainting !== undefined) return byPainting;
  }
  return groupType;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function normalizeIdentity(inputs: IdentityInputs): IdentityOutput {
  const {
    groupType,
    rowIds,
    en,
    cn,
    jp,
    isEnReleased,
    isResearch,
    groupRow,
    lookups,
    availableThumbnails,
  } = inputs;

  // ------------------------------------------------------------------
  // Resolve the LB3 row ID — the row whose key ends with "4", or last entry.
  // ------------------------------------------------------------------
  const lb3RowId = rowIds.find((id) => id.endsWith("4")) ?? rowIds[rowIds.length - 1] ?? groupType;

  const enStats = en.statistics[lb3RowId];
  if (enStats === undefined) {
    throw new Error(
      `normalizeIdentity: missing EN statistics row "${lb3RowId}" for group_type "${groupType}"`,
    );
  }
  const enTemplate = en.template[lb3RowId];
  if (enTemplate === undefined) {
    throw new Error(
      `normalizeIdentity: missing EN template row "${lb3RowId}" for group_type "${groupType}"`,
    );
  }

  // ------------------------------------------------------------------
  // Names
  // ------------------------------------------------------------------

  // EN name: prefer statistics.name if not Chinese, else fall back to english_name
  let nameEn: string | undefined;
  const rawName = enStats.name;
  const rawEnglishName = enStats.english_name;

  // Names are trimmed: upstream has trailing spaces on ~40 rows ("Foch ", "Le Malin μ ", ...)
  if (!isLikelyChinese(rawName) && rawName.trim().length > 0) {
    nameEn = rawName.trim();
  } else if (rawEnglishName !== undefined && rawEnglishName.trim().length > 0 && !isLikelyChinese(rawEnglishName)) {
    nameEn = rawEnglishName.trim();
  }
  // else: both are Chinese/empty → nameEn stays undefined

  // CN name: from cn.statistics matching row if it looks Chinese; else fall back
  // to the EN name field if that was the Chinese value.
  let nameCn: string | undefined;
  if (cn !== undefined) {
    const cnStats = cn.statistics[lb3RowId];
    if (cnStats !== undefined && cnStats.name.trim().length > 0 && isLikelyChinese(cnStats.name)) {
      nameCn = cnStats.name.trim();
    }
  }
  if (nameCn === undefined && isLikelyChinese(rawName)) {
    nameCn = rawName.trim();
  }

  // JP name: from jp.statistics matching row if provided
  let nameJp: string | undefined;
  if (jp !== undefined) {
    const jpStats = jp.statistics[lb3RowId];
    if (jpStats !== undefined && jpStats.name.trim().length > 0) {
      nameJp = jpStats.name.trim();
    }
  }

  // Code: english_name from EN statistics
  const nameCode: string | undefined =
    rawEnglishName !== undefined && rawEnglishName.trim().length > 0 ? rawEnglishName.trim() : undefined;

  const names: Ship["names"] = {};
  if (nameEn !== undefined) names.en = nameEn;
  if (nameCn !== undefined) names.cn = nameCn;
  if (nameJp !== undefined) names.jp = nameJp;
  if (nameCode !== undefined) names.code = nameCode;

  // ------------------------------------------------------------------
  // Rarity
  // ------------------------------------------------------------------
  const rarityInt = enStats.rarity;
  const rarity = rarityName(rarityInt, isResearch) as Ship["rarity"];

  // ------------------------------------------------------------------
  // Stars
  // ------------------------------------------------------------------
  const starMax = enTemplate.star_max;
  const stars: Ship["stars"] = {
    stars: starsString(starMax),
    value: starMax,
  };

  // ------------------------------------------------------------------
  // Class
  // ------------------------------------------------------------------
  const tagListFallback = enStats.tag_list?.[0];
  const shipClass = lookups.classNameFor(groupType, tagListFallback);

  // ------------------------------------------------------------------
  // Hull type
  // ------------------------------------------------------------------
  const hullType = lookups.hullTypeName(enTemplate.type);

  // ------------------------------------------------------------------
  // Nationality
  // ------------------------------------------------------------------
  // The per-ship statistics row is authoritative; ship_data_group is the fallback.
  // They disagree for exactly one ship in EN 9.3.384: Musashi-chan (30517), where the
  // group row says Iron Blood and the ship row says Sakura Empire.
  const nationality = nationalityName(enStats.nationality ?? groupRow.nationality);

  // ------------------------------------------------------------------
  // Wiki URL
  // ------------------------------------------------------------------
  const wikiUrl = nameEn !== undefined ? wikiUrlFor(nameEn) : undefined;

  // ------------------------------------------------------------------
  // Thumbnail (shipyard icon from azurlane-images repo)
  // ------------------------------------------------------------------
  const defaultPainting = en.skinTemplate?.[`${groupType}0`]?.painting;
  const thumbnail = `${THUMBNAILS_URL}/${resolveThumbnail(groupType, defaultPainting, availableThumbnails)}.png`;

  // ------------------------------------------------------------------
  // Build output
  // ------------------------------------------------------------------
  const output: IdentityOutput = {
    id: groupType,
    names,
    rarity,
    stars,
    class: shipClass,
    hullType,
    nationality,
    thumbnail,
  };

  if (wikiUrl !== undefined) {
    output.wikiUrl = wikiUrl;
  }

  // Only emit isEnReleased when false (saves space for the common case)
  if (!isEnReleased) {
    output.isEnReleased = false;
  }

  return output;
}
