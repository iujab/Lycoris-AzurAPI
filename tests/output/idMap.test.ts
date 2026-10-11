import { describe, it, expect } from "vitest";
import { buildIdMap } from "../../src/output/writeIdMap.js";
import type { Ship } from "../../src/schema/output/ship.js";

// Minimal stand-ins: only id + names matter to the id map.
const ship = (id: string, names: Ship["names"]): Ship => ({ id, names }) as unknown as Ship;

describe("buildIdMap", () => {
  it("a core-faction ship wins a display-name collision; the other stays reachable by code name", () => {
    const map = buildIdMap(
      [
        ship("10706", { en: "Enterprise", code: "USS Enterprise" }),
        ship("20232", { en: "Enterprise", code: "HMS Enterprise" }),
        ship("29901", { en: "Neptune", code: "HMS Neptune" }),
        ship("1010001", { en: "Neptune", code: "HDN Neptune" }),
      ],
      [],
    );
    expect(map["Enterprise"]).toBe("10706");
    expect(map["HMS Enterprise"]).toBe("20232");
    expect(map["Neptune"]).toBe("29901");
    expect(map["HDN Neptune"]).toBe("1010001");
  });

  it("does not depend on input order", () => {
    const map = buildIdMap(
      [ship("1010001", { en: "Neptune", code: "HDN Neptune" }), ship("29901", { en: "Neptune", code: "HMS Neptune" })],
      [],
    );
    expect(map["Neptune"]).toBe("29901");
  });

  it("a code name never shadows another ship's display name", () => {
    const map = buildIdMap(
      [ship("30101", { en: "Fubuki", code: "IJN Fubuki" }), ship("1100005", { en: "Fubuki (Senran Kagura)", code: "Fubuki" })],
      [],
    );
    expect(map["Fubuki"]).toBe("30101");
  });

  it("emits legacy padded codes from group rows", () => {
    const map = buildIdMap([], [{ code: 77, group_type: 10706 }]);
    expect(map["077"]).toBe("10706");
  });
});
