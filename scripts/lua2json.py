#!/usr/bin/env python3
"""Convert AzurLaneTools/AzurLaneLuaScripts sharecfg tables to JSON.

Produces the same layout and conventions that AzurLaneTools/AzurLaneData used
(dead since 2026-05-08), which src/ingest reads:

    <out>/<REGION>/sharecfgdata/<table>.json   (big row tables)
    <out>/<REGION>/ShareCfg/<table>.json       (everything else)

Each JSON is { "<id>": {row}, ... } plus an "all": [ids] index when the Lua
table has one (the ingest layer strips it). Empty Lua tables become [], Lua
sequences become arrays, everything else becomes objects with string keys,
and integral numbers are written as integers (LuaJIT has no int/float split).

Requires the `lupa` package (pip install lupa). Lua files are executed in a
runtime with the os/io/load/require family removed; they are plain table
literals from a third-party repo.

Usage:
    python3 scripts/lua2json.py <lua-repo-root> <out-root> [--regions EN,CN,JP] [--tables a,b]
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time

try:
    import lupa
    from lupa import LuaRuntime
except ImportError:  # pragma: no cover
    sys.exit("lua2json: the `lupa` package is required (pip install lupa)")

# table -> output sub-directory, mirroring the AzurLaneData layout the ingest expects
TABLES: dict[str, str] = {
    "ship_data_breakout": "sharecfgdata",
    "ship_data_statistics": "sharecfgdata",
    "ship_data_template": "sharecfgdata",
    "ship_skin_words": "sharecfgdata",
    "shop_template": "sharecfgdata",
    "attribute_info_by_type": "ShareCfg",
    "equip_data_by_type": "ShareCfg",
    "fleet_tech_group": "ShareCfg",
    "fleet_tech_ship_class": "ShareCfg",
    "fleet_tech_ship_template": "ShareCfg",
    "ship_data_blueprint": "ShareCfg",
    "ship_data_by_star": "ShareCfg",
    "ship_data_by_type": "ShareCfg",
    "ship_data_create_exchange": "ShareCfg",
    "ship_data_group": "ShareCfg",
    "ship_data_strengthen": "ShareCfg",
    "ship_data_trans": "ShareCfg",
    "ship_skin_template": "ShareCfg",
    "ship_strengthen_blueprint": "ShareCfg",
    "skill_data_display": "ShareCfg",
    "skill_data_template": "ShareCfg",
    "transform_data_template": "ShareCfg",
    "voice_actor_CN": "ShareCfg",
}

PRELUDE = """
pg = {}
pg.base = {}
confNEO = {}
os = nil; io = nil; require = nil; load = nil; loadstring = nil
dofile = nil; loadfile = nil; package = nil; debug = nil; collectgarbage = nil
"""


def find_file(root: str, region: str, sub: str, table: str) -> str | None:
    """Case-insensitive lookup of <root>/<region>/<sub>/<table>.lua."""
    d = os.path.join(root, region, sub)
    if not os.path.isdir(d):
        return None
    want = f"{table}.lua".lower()
    for name in os.listdir(d):
        if name.lower() == want:
            return os.path.join(d, name)
    return None


def to_py(v):
    if lupa.lua_type(v) == "table":
        keys = list(v.keys())
        if not keys:
            return []
        if all(isinstance(k, int) for k in keys) and sorted(keys) == list(range(1, len(keys) + 1)):
            return [to_py(v[i]) for i in range(1, len(keys) + 1)]
        return {str(k): to_py(v[k]) for k in keys}
    if isinstance(v, float) and v.is_integer():
        return int(v)
    if isinstance(v, bytes):
        return v.decode("utf-8", "replace")
    return v


def convert_table(root: str, region: str, table: str) -> dict | None:
    # Load order: sharecfg/<t>.lua (index + maybe rows), then any streamed chunks in
    # sharecfg/<t>_sublist/*.lua (older layout), then sharecfgdata/<t>.lua (rows).
    sources = [p for p in (find_file(root, region, "sharecfg", table),) if p]
    sublist = os.path.join(root, region, "sharecfg", f"{table}_sublist")
    if os.path.isdir(sublist):
        chunks = [f for f in os.listdir(sublist) if f.lower().endswith(".lua")]
        chunks.sort(key=lambda f: (len(f), f))  # _1, _2, ... _10 in numeric order
        sources += [os.path.join(sublist, f) for f in chunks]
    data_file = find_file(root, region, "sharecfgdata", table)
    if data_file:
        sources.append(data_file)
    if not sources:
        return None
    lua = LuaRuntime(register_eval=False, register_builtins=False, unpack_returned_tuples=True)
    lua.execute(PRELUDE)
    for src in sources:
        with open(src, encoding="utf-8") as f:
            code = f.read()
        # The decompiled files chain `end)()` and a following `(function () ... end)()`
        # with no separator; Lua then parses the second chunk as a call on the first
        # chunk's (nil) result. A leading `;` restores the statement boundary.
        code = re.sub(r"^\(function", ";(function", code, flags=re.M)
        # sharecfgdata files assume pg.base.<table> already exists
        lua.execute(f"pg.base.{table} = pg.base.{table} or {{}}")
        lua.execute(code)
    # Current format: rows in pg.base.<table>, index in pg.<table>.all.
    # Older format (pre mid-2026): rows inline in pg.<table> next to its `all`.
    meta = lua.eval(f"pg.{table}")
    # Rows live in pg.base.<table>; streamed chunks (sharecfg/<t>_sublist/) fill
    # pg.base.<table>_1, _2, ... which the game merges, so merge them here too.
    merged: dict = {}
    base = lua.eval("pg.base")
    chunk_re = re.compile(rf"^{re.escape(table)}(_\d+)?$")
    for name in base.keys():
        if isinstance(name, str) and chunk_re.match(name):
            t = base[name]
            if lupa.lua_type(t) == "table":
                for k in t.keys():
                    merged[k] = t[k]
    if not merged and lupa.lua_type(meta) == "table":
        # Older inline format: rows sit in pg.<table> next to `all` (id keys only;
        # string keys are `all`, __name and helper indexes)
        merged = {k: meta[k] for k in meta.keys() if isinstance(k, int)}
    out: dict = {}
    for k in sorted(merged.keys(), key=lambda k: (0, k) if isinstance(k, int) else (1, str(k))):
        out[str(k)] = to_py(merged[k])
    if lupa.lua_type(meta) == "table":
        all_ids = meta["all"]
        if lupa.lua_type(all_ids) == "table":
            out["all"] = to_py(all_ids)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("lua_root")
    ap.add_argument("out_root")
    ap.add_argument("--regions", default="EN,CN,JP")
    ap.add_argument("--tables", default=",".join(TABLES))
    args = ap.parse_args()

    regions = [r.strip() for r in args.regions.split(",") if r.strip()]
    tables = [t.strip() for t in args.tables.split(",") if t.strip()]
    unknown = [t for t in tables if t not in TABLES]
    if unknown:
        sys.exit(f"lua2json: unknown tables {unknown}; known: {sorted(TABLES)}")

    failures = 0
    for region in regions:
        t0 = time.time()
        for table in tables:
            try:
                data = convert_table(args.lua_root, region, table)
            except Exception as e:  # noqa: BLE001 - report and keep going
                print(f"lua2json: {region}/{table}: FAILED: {e}", file=sys.stderr)
                failures += 1
                continue
            if data is None:
                print(f"lua2json: {region}/{table}: no source file", file=sys.stderr)
                failures += 1
                continue
            out_dir = os.path.join(args.out_root, region, TABLES[table])
            os.makedirs(out_dir, exist_ok=True)
            with open(os.path.join(out_dir, f"{table}.json"), "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            nrows = len(data) - (1 if "all" in data else 0)
            print(f"lua2json: {region}/{table}: {nrows} rows")
        print(f"lua2json: {region} done in {time.time() - t0:.1f}s")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
