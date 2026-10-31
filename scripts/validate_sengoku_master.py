#!/usr/bin/env python3
"""Validate candidate references/compatibility. --release additionally blocks pending facts."""

import argparse, hashlib, json, pathlib, sys, urllib.parse

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from generate_sengoku_master import ROOT, load, dump, read_source, norm


def validate(folder, source=None, release=False):
    f = pathlib.Path(folder)
    data = {
        k: load(f / (k + ".json"))
        for k in [
            "people",
            "people-archive",
            "sites",
            "cards",
            "links",
            "history",
            "summary",
            "id-map",
            "search-index",
        ]
    }
    errors = []
    passed = []

    def check(cond, msg):
        (passed if cond else errors).append(msg)

    for k in ["people", "people-archive", "sites", "cards", "links"]:
        ids = [r.get("id") for r in data[k]]
        check(
            all(isinstance(i, str) and i for i in ids) and len(ids) == len(set(ids)),
            k + ": unique nonempty IDs",
        )
    source = read_source(source or ROOT / "migration/input/master-snapshot.json")
    ps = data["people"]
    ar = data["people-archive"]
    pids = {p["id"] for p in ps}
    aids = {p["id"] for p in ar}
    allids = pids | aids
    sids = {s["id"] for s in data["sites"]}
    pairs = {(l["siteId"], l["personId"]) for l in data["links"]}
    check(len(ps) == source["selectionCounts"]["selected"], "selected count equals H column")
    check(
        {p["masterKey"] for p in ps} == {"roster:" + str(r["values"][8]) for r in source["rows"]},
        "exact selected master keys",
    )
    check(not pids & aids, "active/archive separation")
    constraints = load(ROOT / "migration/input/identity-constraints.json")["distinctPairs"]
    key_ids = {p["selection"]["rosterId"]: p["id"] for p in ps}
    check(
        all(
            len({key_ids[k] for k in c["rosterIds"] if k in key_ids})
            == sum(k in key_ids for k in c["rosterIds"])
            for c in constraints
        ),
        "explicit same-name distinct-person constraints",
    )
    check(
        len({norm(p["name"]) for p in ps}) == len(ps),
        "no duplicate canonical normalized names (not proof of unique historical identity)",
    )
    check(
        all(c["personId"] in allids and c["siteId"] in sids for c in data["cards"]),
        "card person/site resolution",
    )
    check(
        all(l["personId"] in allids and l["siteId"] in sids for l in data["links"]),
        "link person/site resolution",
    )
    check(
        all((c["siteId"], c["personId"]) in pairs for c in data["cards"]),
        "every card has a site/person link",
    )
    check(all(p.get("active") is False for p in ar), "archive explicitly inactive")
    backup = ROOT / "migration/backup"
    manifest = load(backup / "manifest.json")
    check(
        all(
            hashlib.sha256((backup / k).read_bytes()).hexdigest() == v
            for k, v in manifest["files"].items()
        ),
        "backup SHA256 matches manifest",
    )
    check(
        data["sites"] == load(backup / "sites.json"), "all sites preserved without content changes"
    )
    check(data["history"] == load(backup / "history.json"), "history unchanged")
    for table in ["cards", "links"]:
        old = {r["id"]: r for r in load(backup / (table + ".json"))}
        check({r["id"] for r in data[table]} == set(old), table + ": all legacy IDs preserved")
        check(
            all(
                {k: v for k, v in r.items() if k != "personId"}
                == {k: v for k, v in old[r["id"]].items() if k != "personId"}
                for r in data[table]
            ),
            table + ": content preserved except person reference",
        )
    check(
        all(
            (
                p["verification"] != "verified"
                or all(v == "verified" for v in p["fieldStatus"].values())
            )
            for p in ps
        ),
        "no overall verified person with unresolved fields",
    )
    check(
        all(p["verification"] in ["needs_review", "verified"] for p in ps),
        "candidate has explicit review state",
    )
    check(
        all(
            y["value"] is None or type(y["value"]) is int
            for p in ps
            for y in [p["birth"], p["death"]]
        ),
        "unknown/disputed year is nullable, no string numeric coercion",
    )
    check(
        all(
            p["birth"]["value"] is None
            or p["death"]["value"] is None
            or p["birth"]["value"] <= p["death"]["value"]
            for p in ps
        ),
        "birth before death where single values exist",
    )
    check(
        all(set(ids) <= pids for ids in data["search-index"].values()),
        "search index references selected people only",
    )
    check(
        all(
            all(
                urllib.parse.urlparse(u).scheme in ["https", "http"]
                and urllib.parse.urlparse(u).netloc
                for u in p["sources"]
            )
            for p in ps
        ),
        "source URL syntax valid (not source relevance)",
    )
    check(
        len(data["id-map"]) == len(load(backup / "people.json")),
        "one mapping/disposition per old person",
    )
    check(
        all(x["newId"] is None or x["newId"] in pids for x in data["id-map"]),
        "mapping targets selected IDs",
    )
    check(
        set(r["personId"] for r in data["cards"] + data["links"]) - pids == aids,
        "archive contains exactly the referenced inactive people",
    )
    check(
        data["summary"]["remainingStructuralDanglingReferences"] == 0,
        "reported dangling references match zero",
    )
    if release:
        check(
            all(p["verification"] == "verified" for p in ps),
            "release: all facts independently reviewed",
        )
        check(
            all(p["license"]["status"] == "cleared" for p in ps),
            "release: all commercial reuse conditions cleared",
        )
        check(
            all(p["fieldStatus"]["identity"] == "verified" for p in ps),
            "release: duplicate historical identity audit complete",
        )
    return {
        "mode": "release" if release else "candidate",
        "passed": len(passed),
        "failed": len(errors),
        "checksPassed": passed,
        "errors": errors,
        "limitations": [
            "Normalized names/registry checks cannot prove historical uniqueness.",
            "Automated URL checks cannot verify facts or licensing.",
            "No iPhone real-device coverage.",
        ],
    }


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=str(ROOT / "migration/generated"))
    ap.add_argument("--input")
    ap.add_argument("--release", action="store_true")
    ap.add_argument("--report")
    a = ap.parse_args()
    r = validate(a.data, a.input, a.release)
    if a.report:
        dump(a.report, r)
    print(json.dumps(r, ensure_ascii=False, indent=2))
    sys.exit(bool(r["failed"]))
