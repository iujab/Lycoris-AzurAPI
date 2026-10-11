import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { buildShip, buildAllShips, createBuildContext } from "../../src/normalize/ship.js";
import type { BuildContext } from "../../src/normalize/ship.js";

let ctx: BuildContext;

beforeAll(async () => {
  ctx = await createBuildContext();
});

describe("buildShip", () => {
  describe("Belfast (20212) — Super Rare CL", () => {
    it("identity", () => {
      const ship = buildShip("20212", ctx);
      expect(ship).not.toBeNull();
      if (!ship) return;
      expect(ship.id).toBe("20212");
      expect(ship.names.en).toBe("Belfast");
      expect(ship.names.code).toBe("HMS Belfast");
      expect(ship.rarity).toBe("Super Rare");
      expect(ship.hullType).toBe("Light Cruiser");
      expect(ship.nationality).toBe("Royal Navy");
      expect(ship.class).toBe("Edinburgh Class");
      expect(ship.stars.value).toBe(6);
      expect(typeof ship.retrofit).toBe("boolean"); // she gained a retrofit in 2026
    });

    it("stats", () => {
      const ship = buildShip("20212", ctx)!;
      // Level 100 stats (with enhance)
      expect(ship.stats.level100.health).toBe(3400);
      expect(ship.stats.level100.firepower).toBe(160);
      expect(ship.stats.level100.torpedo).toBe(304);
      expect(ship.stats.level100.antiwar).toBe(253);
      expect(ship.stats.level100.reload).toBe(163);
      // Level 120
      expect(ship.stats.level120.health).toBeGreaterThan(3400);
      // Retrofit stats are present exactly when the ship has a retrofit
      expect(ship.stats.level100Retrofit !== undefined).toBe(ship.retrofit);
      expect(ship.stats.level120Retrofit !== undefined).toBe(ship.retrofit);
      // Enhance
      expect(ship.enhanceValue).toEqual({ firepower: 33, torpedo: 63, aviation: 0, reload: 50 });
    });

    it("slots", () => {
      const ship = buildShip("20212", ctx)!;
      expect(ship.slots).toHaveLength(3);
      expect(ship.slots[0]!.maxEfficiency).toBe(1.5);
      expect(ship.slots[1]!.maxEfficiency).toBe(1.55);
    });

    it("skills", () => {
      const ship = buildShip("20212", ctx)!;
      expect(ship.skills.length).toBeGreaterThanOrEqual(3);
      expect(ship.skills.map(s => s.names.en)).toEqual(expect.arrayContaining([
        "Burn Order",
        "Smokescreen: Light Cruisers",
        expect.stringContaining("All Out Assault"),
      ]));
      // Check placeholder substitution worked
      const burnOrder = ship.skills.find(s => s.names.en === "Burn Order")!;
      expect(burnOrder.description).toContain("25.0%");
      expect(burnOrder.description).not.toContain("$1");
      // Burn Order is an offensive skill (game type 1) → "red"
      expect(burnOrder.color).toBe("red");
    });

    it("limit breaks", () => {
      const ship = buildShip("20212", ctx)!;
      expect(ship.limitBreaks).toHaveLength(3);
      // limitBreaks is an array of arrays; first element contains 'Unlock All Out Assault'
      const lb0 = ship.limitBreaks![0]!;
      expect(Array.isArray(lb0)).toBe(true);
      expect((lb0 as string[]).some(s => s.includes("Unlock All Out Assault"))).toBe(true);
    });

    it("construction", () => {
      const ship = buildShip("20212", ctx)!;
      expect(ship.construction?.availableIn?.light).toBe(true);
      expect(ship.construction?.availableIn?.heavy).toBe(false);
    });

    it("fleet tech", () => {
      const ship = buildShip("20212", ctx)!;
      expect(ship.fleetTech?.techPoints.total).toBe(54);
    });

    it("skins", () => {
      const ship = buildShip("20212", ctx)!;
      expect(ship.skins.length).toBeGreaterThanOrEqual(5);
      const defaultSkin = ship.skins.find(s => s.info.obtainedFrom === "Default");
      expect(defaultSkin).toBeDefined();
    });

    it("misc", () => {
      const ship = buildShip("20212", ctx)!;
      expect(ship.misc?.voice?.name).toBe("Yui Horie");
    });
  });

  describe("Javelin (20121) — Elite DD, has retrofit", () => {
    it("identity + retrofit", () => {
      const ship = buildShip("20121", ctx);
      expect(ship).not.toBeNull();
      if (!ship) return;
      expect(ship.names.en).toBe("Javelin");
      expect(ship.rarity).toBe("Elite");
      expect(ship.hullType).toBe("Destroyer");
      expect(ship.retrofit).toBe(true);
    });

    it("has retrofit stats", () => {
      const ship = buildShip("20121", ctx)!;
      expect(ship.stats.level100Retrofit).toBeDefined();
      expect(ship.stats.level120Retrofit).toBeDefined();
      // Retrofit stats should be >= non-retrofit
      expect(ship.stats.level100Retrofit!.health).toBeGreaterThanOrEqual(ship.stats.level100.health);
    });
  });

  describe("Enterprise (10706) — Super Rare CV, Eagle Union", () => {
    it("identity", () => {
      // Find Enterprise's group_type by scanning for code === 77 in ship_data_group
      let enterpriseGroupType: string | undefined;
      for (const [, val] of Object.entries(ctx.en.group)) {
        if (val !== undefined && val.code === 77) {
          enterpriseGroupType = String(val.group_type);
          break;
        }
      }
      expect(enterpriseGroupType).toBeDefined();
      const ship = buildShip(enterpriseGroupType!, ctx);
      expect(ship).not.toBeNull();
      expect(ship!.names.en).toBe("Enterprise");
      expect(ship!.rarity).toBe("Super Rare");
      expect(ship!.hullType).toBe("Aircraft Carrier");
      expect(ship!.nationality).toBe("Eagle Union");
    });
  });

  describe("ships whose LB row ids start with 9 (issue #2)", () => {
    // Vichya Dominion (9xxxx), Tempesta (960xxx) and META (970xxx/971xxx) all have
    // real limit-break rows at 9-prefixed ids; only 900xxx rows are alt forms.
    it("Jean Bart (90501) — Vichya Dominion", () => {
      const ship = buildShip("90501", ctx);
      expect(ship).not.toBeNull();
      expect(ship!.names.en).toContain("Jean Bart");
      expect(ship!.nationality).toBe("Vichya Dominion");
    });

    it("Royal Fortune (960001) — Tempesta", () => {
      const ship = buildShip("960001", ctx);
      expect(ship).not.toBeNull();
      expect(ship!.names.en).toContain("Royal Fortune");
      expect(ship!.nationality).toBe("Tempesta");
    });

    it("Hunter META (970101) — META", () => {
      const ship = buildShip("970101", ctx);
      expect(ship).not.toBeNull();
      expect(ship!.names.en).toContain("Hunter");
      expect(ship!.nationality).toBe("META");
    });

    it("Foch (90301) — name is trimmed (upstream has a trailing space)", () => {
      const ship = buildShip("90301", ctx);
      expect(ship).not.toBeNull();
      expect(ship!.names.en).toBe("Foch");
    });

    it("Neptune (1010001) — Neptunia collab, not META", () => {
      const ship = buildShip("1010001", ctx);
      expect(ship).not.toBeNull();
      expect(ship!.nationality).toBe("Neptunia");
    });
  });

  describe("thumbnail resolution", () => {
    // Shipyard icons are named by group id for older ships (20212.png) but by the
    // default skin's painting name for newer ones (weikesibao.png, z14.png, 2B.png).
    let saved: BuildContext["availableThumbnails"];
    beforeEach(() => { saved = ctx.availableThumbnails; });
    afterEach(() => { ctx.availableThumbnails = saved; });

    it("prefers the group id when that file exists", () => {
      ctx.availableThumbnails = new Map([["20212", "20212"], ["beierfasite", "beierfasite"]]);
      expect(buildShip("20212", ctx)!.thumbnail).toMatch(/\/20212\.png$/);
    });

    it("falls back to the default skin's painting name, keeping its case", () => {
      ctx.availableThumbnails = new Map([["weikesibao", "weikesibao"], ["2b", "2B"]]);
      expect(buildShip("10236", ctx)!.thumbnail).toMatch(/\/weikesibao\.png$/);   // Vicksburg
      expect(buildShip("1170002", ctx)!.thumbnail).toMatch(/\/2B\.png$/);          // 2B
    });

    it("keeps the group id when nothing is known or nothing matches", () => {
      ctx.availableThumbnails = undefined;
      expect(buildShip("10236", ctx)!.thumbnail).toMatch(/\/10236\.png$/);
      ctx.availableThumbnails = new Map([["unrelated", "unrelated"]]);
      expect(buildShip("10236", ctx)!.thumbnail).toMatch(/\/10236\.png$/);
    });
  });

  describe("bulk build", () => {
    it("builds every group in ship_data_group (851 in snapshot 4cca5c24)", () => {
      const ships = buildAllShips(ctx);
      expect(ships.length).toBeGreaterThanOrEqual(850);
      // Every ship must have required fields
      for (const ship of ships) {
        expect(ship.id).toBeTruthy();
        expect(ship.names.en).toBeTruthy();
        // No name may carry leading/trailing whitespace (39 upstream rows do)
        for (const n of Object.values(ship.names)) expect(n).toBe(n.trim());
      }
    });
  });
});
