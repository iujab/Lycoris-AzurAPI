import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// The built package must find its bundled data/ no matter where the consumer's
// process runs from. The ESM build used to walk up from process.cwd() (no
// __dirname under ESM), so `new AzurData()` threw ENOENT after a plain npm install.
const root = fileURLToPath(new URL("../..", import.meta.url));
const esm = path.join(root, "dist", "index.js");
const cjs = path.join(root, "dist", "cjs", "index.js");

function run(args: string[]): string {
  return execFileSync(process.execPath, args, { cwd: os.tmpdir(), encoding: "utf8" }).trim();
}

describe.skipIf(!existsSync(esm) || !existsSync(cjs))("built entries from a foreign cwd", () => {
  it("ESM entry finds its bundled data", () => {
    const out = run(["--input-type=module", "-e",
      `import { AzurData } from ${JSON.stringify(pathToFileURL(esm).href)}; console.log(new AzurData().ships.count())`]);
    expect(Number(out)).toBeGreaterThanOrEqual(840);
  });

  it("CJS entry finds its bundled data", () => {
    const out = run(["-e", `console.log(new (require(${JSON.stringify(cjs)}).AzurData)().ships.count())`]);
    expect(Number(out)).toBeGreaterThanOrEqual(840);
  });
});
