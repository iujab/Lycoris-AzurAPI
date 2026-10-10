import type { Ship } from "../schema/output/ship.js";
import { ShipSchema } from "../schema/output/ship.js";
import type { Region } from "../ingest/upstream.js";
import type {
  ShipDataTemplate,
  ShipDataStatistics,
  ShipDataBreakout,
  ShipDataStrengthen,
  ShipStrengthenBlueprint,
  ShipDataBlueprint,
  ShipDataTrans,
  ShipDataGroup,
  ShipSkinTemplate,
  ShopTemplate,
  ShipDataCreateExchange,
  ShipDataByType,
  ShipDataByStar,
  FleetTechShipTemplate,
  FleetTechShipClass,
  SkillDataTemplate,
  SkillDataDisplay,
  TransformDataTemplate,
  EquipDataByType,
  VoiceActorCn,
  AttributeInfoByType,
  ShipDataGroupValue,
} from "../schema/raw/index.js";
import type { Lookups } from "../translate/lookups.js";
import { normalizeIdentity } from "./identity.js";
import { normalizeStats } from "./stats.js";
import { normalizeSlots } from "./slots.js";
import { normalizeSkills } from "./skills.js";
import { normalizeConstruction } from "./construction.js";
import { normalizeRetrofit } from "./retrofit.js";
import { normalizeMisc } from "./misc.js";
import { normalizeSkins } from "./skins.js";

// ---------------------------------------------------------------------------
// BuildContext
// ---------------------------------------------------------------------------

export interface BuildContext {
  region: Region;
  en: {
    template: ShipDataTemplate;
    statistics: ShipDataStatistics;
    breakout: ShipDataBreakout;
    strengthen: ShipDataStrengthen;
    strengthenBlueprint: ShipStrengthenBlueprint;
    blueprint: ShipDataBlueprint;
    trans: ShipDataTrans;
    group: ShipDataGroup;
    skinTemplate: ShipSkinTemplate;
    shopTemplate: ShopTemplate;
    exchange: ShipDataCreateExchange;
    shipDataByType: ShipDataByType;
    shipDataByStar: ShipDataByStar;
    fleetTechShipTemplate: FleetTechShipTemplate;
    fleetTechShipClass: FleetTechShipClass;
    skillDataTemplate: SkillDataTemplate;
    skillDataDisplay: SkillDataDisplay;
    transformDataTemplate: TransformDataTemplate;
    equipDataByType: EquipDataByType;
    voiceActorCn: VoiceActorCn;
    attributeInfoByType: AttributeInfoByType;
  };
  cn?: {
    statistics: ShipDataStatistics;
    group: ShipDataGroup;
    template: ShipDataTemplate;
  };
  jp?: {
    statistics: ShipDataStatistics;
  };
  overrides?: {
    constructionTimes?: Record<string, string>;
    artists?: Record<string, string>;
  };
  lookups: Lookups;
  thumbnailBaseUrl?: string;
  /** Set of available painting filenames (lowercase, no extension) for skin variant lookup. */
  availablePaintings?: Set<string>;
}

// ---------------------------------------------------------------------------
// Limit-break row detection
// ---------------------------------------------------------------------------

/**
 * True when `key` is one of a group's real limit-break rows: the group_type
 * followed by a single LB digit (1-4), e.g. 20212 -> 202121..202124.
 *
 * Anything else is an alt/promo form of a ship that also has real LB rows
 * (the 900xxx block: 900004 -> Suffolk, 900465 -> Adventure Galley, ...).
 *
 * Do NOT filter on a "9" prefix instead: Vichya Dominion (9xxxx), Tempesta
 * (960xxx) and META (97xxxx) ships all have their real LB rows at 9-prefixed
 * ids. That heuristic silently dropped all 99 of them (issue #2).
 */
export function isLimitBreakRow(key: string, groupType: string): boolean {
  if (key.length !== groupType.length + 1 || !key.startsWith(groupType)) return false;
  const lb = key[key.length - 1];
  return lb === "1" || lb === "2" || lb === "3" || lb === "4";
}

// ---------------------------------------------------------------------------
// Pre-built indexes (created once in buildAllShips, passed to buildShip)
// ---------------------------------------------------------------------------

interface BuildIndexes {
  /** group_type (string) → group row */
  groupByGroupType: Map<string, ShipDataGroupValue>;
  /** group_type (string) → set of blueprint keys (i.e. group_type is a research ship) */
  researchGroupTypes: Set<string>;
}

function buildIndexes(ctx: BuildContext): BuildIndexes {
  // Build groupByGroupType: scan ship_data_group and index by group_type
  const groupByGroupType = new Map<string, ShipDataGroupValue>();
  for (const row of Object.values(ctx.en.group)) {
    if (row === undefined) continue;
    groupByGroupType.set(String(row.group_type), row);
  }

  // Build researchGroupTypes: blueprint keys are themselves group_types
  // (confirmed: all 42 blueprint keys appear as group_type values in ship_data_template)
  const researchGroupTypes = new Set<string>();
  for (const key of Object.keys(ctx.en.blueprint)) {
    researchGroupTypes.add(key);
  }

  return { groupByGroupType, researchGroupTypes };
}

// ---------------------------------------------------------------------------
// buildShip
// ---------------------------------------------------------------------------

export function buildShip(
  groupType: string,
  ctx: BuildContext,
  indexes?: BuildIndexes,
): Ship | null {
  const idx = indexes ?? buildIndexes(ctx);

  // -------------------------------------------------------------------------
  // 1. Resolve LB rows for this group_type
  // -------------------------------------------------------------------------
  const rowIds: string[] = [];
  for (const [key, row] of Object.entries(ctx.en.template)) {
    if (row === undefined) continue;
    if (String(row.group_type) !== groupType) continue;
    // Keep only the real LB rows; skips the 900xxx alt/promo forms
    if (!isLimitBreakRow(key, groupType)) continue;
    rowIds.push(key);
  }

  if (rowIds.length === 0) {
    return null;
  }

  // Sort by last digit (LB stage suffix: 1/2/3/4)
  rowIds.sort((a, b) => {
    const lastA = a[a.length - 1] ?? "0";
    const lastB = b[b.length - 1] ?? "0";
    return lastA.localeCompare(lastB);
  });

  // lb0RowId = row ending in "1", lb3RowId = row ending in "4"
  const lb0RowId = rowIds.find((id) => id.endsWith("1")) ?? rowIds[0];
  const lb3RowId = rowIds.find((id) => id.endsWith("4")) ?? rowIds[rowIds.length - 1];

  if (lb0RowId === undefined || lb3RowId === undefined) {
    return null;
  }

  // -------------------------------------------------------------------------
  // 2. Resolve the group row (pre-indexed)
  // -------------------------------------------------------------------------
  const groupRow = idx.groupByGroupType.get(groupType);
  if (groupRow === undefined) {
    return null;
  }

  // -------------------------------------------------------------------------
  // 3. Determine isResearch
  // -------------------------------------------------------------------------
  const isResearch = idx.researchGroupTypes.has(groupType);

  // -------------------------------------------------------------------------
  // 4. Determine isEnReleased
  //    True if the LB3 statistics row has a non-empty, non-Chinese name
  // -------------------------------------------------------------------------
  function isLikelyChinese(s: string): boolean {
    return /[\u4e00-\u9fff]/.test(s);
  }

  const lb3Stats = ctx.en.statistics[lb3RowId];
  const lb3Name = lb3Stats?.name ?? "";
  const isEnReleased =
    lb3Name.trim().length > 0 && !isLikelyChinese(lb3Name);

  // -------------------------------------------------------------------------
  // 5. Determine strengthen_id from lb0 template row
  // -------------------------------------------------------------------------
  const lb0Template = ctx.en.template[lb0RowId];
  const strengthenId = lb0Template !== undefined
    ? String(lb0Template.strengthen_id)
    : groupType;

  // ship type from lb3 template
  const lb3Template = ctx.en.template[lb3RowId];
  const shipType = lb3Template?.type ?? 0;
  const starMax = lb3Template?.star_max ?? 6;
  // initialStar: use rarity (from statistics) for the scrap medal lookup.
  // AzurAPI historically mapped rarity → ship_data_by_star tier for medals:
  // rarity 5 (Super Rare) → star 5 → 10 medals.
  const initialStar = lb3Stats?.rarity ?? starMax;

  // -------------------------------------------------------------------------
  // 6. Call each normalizer
  // -------------------------------------------------------------------------

  // Identity
  const identityOutput = normalizeIdentity({
    groupType,
    rowIds,
    en: {
      template: ctx.en.template,
      statistics: ctx.en.statistics,
      group: ctx.en.group,
      blueprint: ctx.en.blueprint,
      fleetTechShipTemplate: ctx.en.fleetTechShipTemplate,
      fleetTechShipClass: ctx.en.fleetTechShipClass,
      shipDataByType: ctx.en.shipDataByType,
    },
    cn: ctx.cn !== undefined ? { statistics: ctx.cn.statistics } : undefined,
    jp: ctx.jp !== undefined ? { statistics: ctx.jp.statistics } : undefined,
    isEnReleased,
    isResearch,
    groupRow,
    lookups: ctx.lookups,
  });

  // Stats
  const statsOutput = normalizeStats({
    lb3RowId,
    groupType,
    strengthenId,
    isResearch,
    en: {
      statistics: ctx.en.statistics,
      strengthen: ctx.en.strengthen,
      strengthenBlueprint: ctx.en.strengthenBlueprint,
      blueprint: ctx.en.blueprint,
      trans: ctx.en.trans,
      transformDataTemplate: ctx.en.transformDataTemplate,
    },
  });

  // Slots
  const slots = normalizeSlots({
    lb0RowId,
    lb3RowId,
    template: ctx.en.template,
    statistics: ctx.en.statistics,
    lookups: ctx.lookups,
  });

  // Skills
  const skillsOutput = normalizeSkills({
    rowIds,
    groupType,
    en: {
      template: ctx.en.template,
      breakout: ctx.en.breakout,
      skillDataTemplate: ctx.en.skillDataTemplate,
      skillDataDisplay: ctx.en.skillDataDisplay,
      trans: ctx.en.trans,
      transformDataTemplate: ctx.en.transformDataTemplate,
    },
  });

  // Construction
  const constructionOutput = normalizeConstruction({
    groupType,
    groupRow,
    lb3RowId,
    shipType,
    starMax,
    initialStar,
    fleetTechShipTemplate: ctx.en.fleetTechShipTemplate,
    shipDataCreateExchange: ctx.en.exchange,
    shipDataByType: ctx.en.shipDataByType,
    shipDataByStar: ctx.en.shipDataByStar,
    lookups: ctx.lookups,
    constructionTimeOverride: ctx.overrides?.constructionTimes?.[groupType],
  });

  // Retrofit
  const retrofitOutput = normalizeRetrofit({
    groupType,
    groupRow,
    trans: ctx.en.trans,
    lookups: ctx.lookups,
  });

  // Misc
  const miscOutput = normalizeMisc({
    defaultSkinId: `${groupType}0`,
    skinTemplate: ctx.en.skinTemplate,
    lookups: ctx.lookups,
    artistOverride: ctx.overrides?.artists?.[groupType],
  });

  // Skins
  const skinsOutput = normalizeSkins({
    groupType,
    skinTemplate: ctx.en.skinTemplate,
    shopTemplate: ctx.en.shopTemplate,
    thumbnailBaseUrl: ctx.thumbnailBaseUrl,
    availablePaintings: ctx.availablePaintings,
  });

  // -------------------------------------------------------------------------
  // 7. Merge all partials into a Ship object
  // -------------------------------------------------------------------------
  const shipCandidate: Ship = {
    id: identityOutput.id,
    names: identityOutput.names,
    rarity: identityOutput.rarity,
    stars: identityOutput.stars,
    thumbnail: identityOutput.thumbnail,
    class: identityOutput.class,
    hullType: identityOutput.hullType,
    nationality: identityOutput.nationality,
    stats: statsOutput.stats,
    enhanceValue: statsOutput.enhanceValue,
    slots,
    skills: skillsOutput.skills,
    retrofit: retrofitOutput.retrofit,
    skins: skinsOutput.skins,
  };

  if (identityOutput.wikiUrl !== undefined) {
    shipCandidate.wikiUrl = identityOutput.wikiUrl;
  }
  if (identityOutput.isEnReleased === false) {
    shipCandidate.isEnReleased = false;
  }
  if (skillsOutput.limitBreaks !== undefined) {
    shipCandidate.limitBreaks = skillsOutput.limitBreaks;
  }
  if (constructionOutput.construction !== undefined) {
    shipCandidate.construction = constructionOutput.construction;
  }
  if (constructionOutput.scrapValue !== undefined) {
    shipCandidate.scrapValue = constructionOutput.scrapValue;
  }
  if (constructionOutput.fleetTech !== undefined) {
    shipCandidate.fleetTech = constructionOutput.fleetTech;
  }
  if (constructionOutput.obtainedFrom !== undefined) {
    shipCandidate.obtainedFrom = constructionOutput.obtainedFrom;
  }
  if (retrofitOutput.retrofitHullType !== undefined) {
    shipCandidate.retrofitHullType = retrofitOutput.retrofitHullType;
  }
  if (miscOutput.misc !== undefined) {
    shipCandidate.misc = miscOutput.misc;
  }

  // -------------------------------------------------------------------------
  // 8. Validate with ShipSchema.parse
  // -------------------------------------------------------------------------
  const parseResult = ShipSchema.safeParse(shipCandidate);
  if (!parseResult.success) {
    console.error(
      `[buildShip] ShipSchema.parse failed for group_type="${groupType}":`,
      parseResult.error.message,
    );
    return null;
  }

  return parseResult.data;
}

// ---------------------------------------------------------------------------
// buildAllShips
// ---------------------------------------------------------------------------

export function buildAllShips(ctx: BuildContext): Ship[] {
  // Pre-build shared indexes once for O(n) total cost
  const indexes = buildIndexes(ctx);

  // Collect all unique group_types that have real LB rows in the EN template
  // (alt/promo 900xxx rows are ignored; see isLimitBreakRow)
  const groupTypeSet = new Set<string>();
  for (const [key, row] of Object.entries(ctx.en.template)) {
    if (row === undefined) continue;
    const groupType = String(row.group_type);
    if (!isLimitBreakRow(key, groupType)) continue;
    groupTypeSet.add(groupType);
  }

  const ships: Ship[] = [];
  let failCount = 0;

  for (const groupType of groupTypeSet) {
    try {
      const ship = buildShip(groupType, ctx, indexes);
      if (ship !== null) {
        ships.push(ship);
      }
    } catch (err) {
      failCount++;
      console.error(
        `[buildAllShips] Unexpected error for group_type="${groupType}":`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  if (failCount > 0) {
    console.warn(`[buildAllShips] ${failCount} ships threw unexpected errors and were skipped.`);
  }

  // Sort by id numerically
  ships.sort((a, b) => Number(a.id) - Number(b.id));

  return ships;
}

// ---------------------------------------------------------------------------
// createBuildContext
// ---------------------------------------------------------------------------

/**
 * Create a BuildContext by loading all EN raw tables plus optional CN/JP overlays.
 * This is a convenience function for scripts/build-data.ts.
 */
export async function createBuildContext(options?: {
  loadCn?: boolean;
  loadJp?: boolean;
  overrides?: BuildContext["overrides"];
  thumbnailBaseUrl?: string;
}): Promise<BuildContext> {
  const {
    loadShipDataTemplate,
    loadShipDataStatistics,
    loadShipDataBreakout,
    loadShipDataStrengthen,
    loadShipStrengthenBlueprint,
    loadShipDataBlueprint,
    loadShipDataTrans,
    loadShipDataGroup,
    loadShipSkinTemplate,
    loadShopTemplate,
    loadShipDataCreateExchange,
    loadShipDataByType,
    loadShipDataByStar,
    loadFleetTechShipTemplate,
    loadFleetTechShipClass,
    loadSkillDataTemplate,
    loadSkillDataDisplay,
    loadTransformDataTemplate,
    loadEquipDataByType,
    loadVoiceActorCn,
    loadAttributeInfoByType,
  } = await import("../ingest/files.js");
  const { createLookups } = await import("../translate/lookups.js");

  const enTemplate = loadShipDataTemplate("EN");
  const enStatistics = loadShipDataStatistics("EN");
  const enBreakout = loadShipDataBreakout("EN");
  const enStrengthen = loadShipDataStrengthen("EN");
  const enStrengthenBlueprint = loadShipStrengthenBlueprint("EN");
  const enBlueprint = loadShipDataBlueprint("EN");
  const enTrans = loadShipDataTrans("EN");
  const enGroup = loadShipDataGroup("EN");
  const enSkinTemplate = loadShipSkinTemplate("EN");
  const enShopTemplate = loadShopTemplate("EN");
  const enExchange = loadShipDataCreateExchange("EN");
  const enShipDataByType = loadShipDataByType("EN");
  const enShipDataByStar = loadShipDataByStar("EN");
  const enFleetTechShipTemplate = loadFleetTechShipTemplate("EN");
  const enFleetTechShipClass = loadFleetTechShipClass("EN");
  const enSkillDataTemplate = loadSkillDataTemplate("EN");
  const enSkillDataDisplay = loadSkillDataDisplay("EN");
  const enTransformDataTemplate = loadTransformDataTemplate("EN");
  const enEquipDataByType = loadEquipDataByType("EN");
  const enVoiceActorCn = loadVoiceActorCn("EN");
  const enAttributeInfoByType = loadAttributeInfoByType("EN");

  const lookups = createLookups({
    fleetTechShipTemplate: enFleetTechShipTemplate,
    fleetTechShipClass: enFleetTechShipClass,
    shipDataByType: enShipDataByType,
    equipDataByType: enEquipDataByType,
    skillDataTemplate: enSkillDataTemplate,
    skillDataDisplay: enSkillDataDisplay,
    voiceActorCn: enVoiceActorCn,
  });

  let cn: BuildContext["cn"];
  if (options?.loadCn === true) {
    const cnStats = loadShipDataStatistics("CN");
    const cnGroup = loadShipDataGroup("CN");
    const cnTemplate = loadShipDataTemplate("CN");
    cn = { statistics: cnStats, group: cnGroup, template: cnTemplate };
  }

  let jp: BuildContext["jp"];
  if (options?.loadJp === true) {
    const jpStats = loadShipDataStatistics("JP");
    jp = { statistics: jpStats };
  }

  return {
    region: "EN",
    en: {
      template: enTemplate,
      statistics: enStatistics,
      breakout: enBreakout,
      strengthen: enStrengthen,
      strengthenBlueprint: enStrengthenBlueprint,
      blueprint: enBlueprint,
      trans: enTrans,
      group: enGroup,
      skinTemplate: enSkinTemplate,
      shopTemplate: enShopTemplate,
      exchange: enExchange,
      shipDataByType: enShipDataByType,
      shipDataByStar: enShipDataByStar,
      fleetTechShipTemplate: enFleetTechShipTemplate,
      fleetTechShipClass: enFleetTechShipClass,
      skillDataTemplate: enSkillDataTemplate,
      skillDataDisplay: enSkillDataDisplay,
      transformDataTemplate: enTransformDataTemplate,
      equipDataByType: enEquipDataByType,
      voiceActorCn: enVoiceActorCn,
      attributeInfoByType: enAttributeInfoByType,
    },
    cn,
    jp,
    overrides: options?.overrides,
    thumbnailBaseUrl: options?.thumbnailBaseUrl,
    lookups,
  };
}
