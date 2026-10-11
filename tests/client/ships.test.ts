import { describe, it, expect } from "vitest";
import { AzurData } from "../../src/client/AzurData.js";

describe("AzurData + Ships", () => {
  // Construct once — heavy on first invocation
  const azur = new AzurData();

  it("loads all ships", () => {
    expect(azur.ships.count()).toBeGreaterThanOrEqual(700);
  });

  it("ships.get by EN name", () => {
    const ship = azur.ships.get("Belfast");
    expect(ship).toBeDefined();
    expect(ship!.names.en).toBe("Belfast");
  });

  it("ships.get case-insensitive", () => {
    const ship = azur.ships.get("belfast");
    expect(ship?.names.en).toBe("Belfast");
  });

  it("ships.get by legacy 3-digit code", () => {
    const ship = azur.ships.get("115");
    expect(ship?.names.en).toBe("Belfast");
  });

  it("ships.get by canonical id", () => {
    const ship = azur.ships.get("20212");
    expect(ship?.names.en).toBe("Belfast");
  });

  it("ships.get by names.code", () => {
    const ship = azur.ships.get("HMS Belfast");
    expect(ship?.names.en).toBe("Belfast");
  });

  it("ships.get fuzzy match", () => {
    const ship = azur.ships.get("Belfats"); // typo
    expect(ship?.names.en).toBe("Belfast");
  });

  it("ships.get accepts typos and prefixes", () => {
    expect(azur.ships.get("Vicksbrg")?.names.en).toBe("Vicksburg");
    expect(azur.ships.get("Enterp")?.names.en).toBe("Enterprise");
    expect(azur.ships.get("Jean Bar")?.names.en).toBe("Jean Bart");
  });

  it("ships.get does not return an unrelated ship for an unknown name", () => {
    // Fuse rates "22" a perfect substring match on U-522 and "Kuon" 0.003 on Kronshtadt
    expect(azur.ships.get("22")).toBeUndefined();
    expect(azur.ships.get("33")).toBeUndefined();
    expect(azur.ships.get("Kuon")).toBeUndefined();
  });

  it("ships.get returns undefined for garbage", () => {
    expect(azur.ships.get("zzzzzzzzzz")).toBeUndefined();
  });

  it("ships.getAll returns array", () => {
    const all = azur.ships.getAll();
    expect(all.length).toBeGreaterThanOrEqual(700);
    expect(all[0]).toHaveProperty("id");
    expect(all[0]).toHaveProperty("names");
  });

  it("ships.search returns multiple results", () => {
    const results = azur.ships.search("Enterprise", 5);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some(s => s.names.en === "Enterprise")).toBe(true);
  });

  it("ships.getById returns ship by canonical id", () => {
    const ship = azur.ships.getById("20212");
    expect(ship?.names.en).toBe("Belfast");
  });

  it("ships.get USS Enterprise by names.code", () => {
    const ship = azur.ships.get("USS Enterprise");
    expect(ship).toBeDefined();
    expect(ship!.names.en).toBe("Enterprise");
    expect(ship!.hullType).toBe("Aircraft Carrier");
    expect(ship!.nationality).toBe("Eagle Union");
  });

  it("ships.get Javelin has retrofit flag", () => {
    const ship = azur.ships.get("Javelin");
    expect(ship).toBeDefined();
    expect(ship!.retrofit).toBe(true);
    expect(ship!.stats.level100Retrofit).toBeDefined();
  });
});
