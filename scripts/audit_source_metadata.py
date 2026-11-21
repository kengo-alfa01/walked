#!/usr/bin/env python3
"""Offline cross-row source/title audit; neither title matches nor HTTP prove facts."""

import collections, pathlib, re, sys, urllib.parse

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from generate_sengoku_master import ROOT, load, dump, csvout, norm, urls

s = load(ROOT / "migration/input/master-snapshot.json")
file = ROOT / "migration/input/source-audit.json"
if not file.exists():
    raise SystemExit("Run scripts/check_master_sources.py first")
checks = load(file)["checks"]
byurl = {x["url"]: x for x in checks}
rows = []
articles = collections.defaultdict(set)
for row in s["rows"]:
    v = row["values"]
    us = list(dict.fromkeys(urls(v[5]) + urls(v[21] if len(v) > 21 else "")))
    titles = set()
    for u in us:
        c = byurl.get(u, {})
        title = c.get("title", "")
        if "ja.wikipedia.org" in u:
            if c.get("status") == 200 and title.endswith(" - Wikipedia"):
                titles.add(title[:-12])
            elif "/wiki/" in u:
                titles.add(urllib.parse.unquote(u.split("/wiki/", 1)[1]).replace("_", " "))
        rows.append(
            {
                "rosterId": v[8],
                "name": v[0],
                "url": u,
                "httpStatus": c.get("status"),
                "pageTitle": title,
                "finalUrl": c.get("finalUrl", ""),
                "error": c.get("error", ""),
                "meaning": "HTTP/title only; source relevance, historical facts and permission unverified",
            }
        )
    for t in titles:
        articles[t].add(v[8])
collisions = [
    {
        "articleTitle": t,
        "rosterIds": sorted(ks, key=int),
        "names": [
            next(r["values"][0] for r in s["rows"] if r["values"][8] == k)
            for k in sorted(ks, key=int)
        ],
        "status": "possible_same_person_or_shared_source; no automatic merge",
    }
    for t, ks in sorted(articles.items())
    if len(ks) > 1
]
summary = {
    "uniqueUrlsAttempted": len(checks),
    "http200": sum(x.get("status") == 200 for x in checks),
    "unavailableOrNon200": sum(x.get("status") != 200 for x in checks),
    "peopleCovered": len(s["rows"]),
    "sharedWikipediaArticleGroups": len(collisions),
    "historicallyVerifiedByThisAudit": 0,
    "note": "An unavailable URL may be a transient timeout, network or encoding issue. It is not evidence the source or person does not exist.",
}
dump(ROOT / "migration/reports/source-metadata-summary.json", summary)
dump(ROOT / "migration/reports/shared-article-review.json", collisions)
csvout(
    ROOT / "migration/reports/source-url-checks.csv",
    rows,
    ["rosterId", "name", "url", "httpStatus", "pageTitle", "finalUrl", "error", "meaning"],
)
csvout(
    ROOT / "migration/reports/shared-article-review.csv",
    collisions,
    ["articleTitle", "rosterIds", "names", "status"],
)
print(summary)
print(collisions)
