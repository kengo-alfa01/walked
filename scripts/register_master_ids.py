#!/usr/bin/env python3
"""Reserve new roster IDs explicitly; never recycle or guess historical aliases."""

import argparse, pathlib, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from generate_sengoku_master import ROOT, read_source, load, dump

ap = argparse.ArgumentParser()
ap.add_argument("--input", required=True)
ap.add_argument("--registry", default=str(ROOT / "migration/input/id-registry.json"))
args = ap.parse_args()
s = read_source(args.input)
reg = load(args.registry)
used = {x["id"] for x in reg.values()}
keys = set()
for row in s["rows"]:
    v = row["values"]
    key = str(v[8])
    name = v[0]
    if not key.isdigit() or key in keys:
        raise SystemExit("Invalid/duplicate immutable roster ID: " + key)
    keys.add(key)
    if key in reg:
        if name != reg[key]["nameAtRegistration"]:
            raise SystemExit(
                "Name changed for "
                + key
                + ": review identity and update nameAtRegistration without changing id"
            )
        continue
    pid = f"sg-master-{int(key):04d}"
    if pid in used:
        raise SystemExit("ID collision")
    reg[key] = {
        "id": pid,
        "nameAtRegistration": name,
        "oldIds": [],
        "mappingStatus": "new",
        "basis": "new immutable roster key; no automatic alias merging",
    }
    used.add(pid)
dump(args.registry, reg)
print("Reserved registry keys:", len(reg))
