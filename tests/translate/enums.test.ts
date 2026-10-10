import { describe, it, expect } from "vitest";
import { nationalityName } from "../../src/translate/enums.js";

// Codes verified against upstream EN ship_data_group.json + ship_data_statistics.json
// (snapshot 4cca5c24, 2026-05-08). See docs/rca-missing-ships.md.
describe("nationalityName", () => {
  it("core factions", () => {
    expect(nationalityName(1)).toBe("Eagle Union");
    expect(nationalityName(2)).toBe("Royal Navy");
    expect(nationalityName(8)).toBe("Iris Libre");
    expect(nationalityName(9)).toBe("Vichya Dominion");
    expect(nationalityName(11)).toBe("Kingdom of Tulipa");
  });

  it("special factions at 96-98", () => {
    expect(nationalityName(96)).toBe("Tempesta");   // MOT Royal Fortune, Golden Hind, ...
    expect(nationalityName(97)).toBe("META");       // Hunter.META, Fortune.META, ...
    expect(nationalityName(98)).toBe("Universal");  // Bulins
  });

  it("collab factions at 101+ (each code is one collab)", () => {
    expect(nationalityName(101)).toBe("Neptunia");            // HDN Neptune, Noire, Blanc, ...
    expect(nationalityName(102)).toBe("Bilibili");            // 22, 33 (CN only)
    expect(nationalityName(103)).toBe("Utawarerumono");       // Kuon, Nekone, ... (CN/JP only)
    expect(nationalityName(104)).toBe("KizunaAI");
    expect(nationalityName(105)).toBe("Hololive");            // Shirakami Fubuki, Tokino Sora, ...
    expect(nationalityName(106)).toBe("Venus Vacation");      // Marie Rose, Honoka, ...
    expect(nationalityName(107)).toBe("The Idolmaster");      // Haruka Amami, ...
    expect(nationalityName(108)).toBe("SSSS");                // Rikka Takarada, ...
    expect(nationalityName(109)).toBe("Atelier Ryza");        // Reisalin Stout, ...
    expect(nationalityName(110)).toBe("Senran Kagura");       // Asuka, Ikaruga, ...
    expect(nationalityName(111)).toBe("To LOVE-Ru");          // Lala Satalin Deviluke, ...
    expect(nationalityName(112)).toBe("Black Rock Shooter");  // BLACK★ROCK SHOOTER, DEAD MASTER
    expect(nationalityName(113)).toBe("Atelier Yumia");       // Yumia Liessfeldt, ...
    expect(nationalityName(114)).toBe("DanMachi");            // Hestia, Ryu Lion
    expect(nationalityName(115)).toBe("Date A Live");         // Tohka Yatogami, ...
  });

  it("unknown codes fall back to Universal", () => {
    expect(nationalityName(9999)).toBe("Universal");
  });
});
