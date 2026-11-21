#!/usr/bin/env python3
"""Optional network audit. HTTP/title/term checks are NOT historical verification.
No document text is redistributed. Run separately from deterministic generation.
"""

import argparse, concurrent.futures, hashlib, json, pathlib, re, urllib.request, urllib.error, urllib.parse, datetime

ROOT = pathlib.Path(__file__).resolve().parents[1]


def urls(text):
    return re.findall(r"https?://[^\s<>]+", text or "")


def check(url):
    try:
        quoted = urllib.parse.quote(url, safe=":/?=&%#;+,@!()[]~_-")
        req = urllib.request.Request(
            quoted, headers={"User-Agent": "WALKED-source-audit/1.0 (metadata verification)"}
        )
        with urllib.request.urlopen(req, timeout=12) as r:
            raw = r.read(2_000_000)
            typ = r.headers.get("Content-Type", "")
            charset = r.headers.get_content_charset() or "utf-8"
            body = raw.decode(charset, errors="replace") if "text" in typ else ""
            m = re.search(r"<title[^>]*>(.*?)</title>", body, re.S | re.I)
            return {
                "url": url,
                "status": r.status,
                "finalUrl": r.url,
                "contentType": typ,
                "title": re.sub(r"\s+", " ", m[1]).strip() if m else "",
                "sampleSha256": hashlib.sha256(raw).hexdigest(),
                "truncatedAt2MB": len(raw) == 2_000_000,
                "assessment": "http_only_not_fact_checked",
            }
    except Exception as e:
        return {
            "url": url,
            "status": None,
            "error": str(e)[:180],
            "assessment": "unavailable_not_disproved",
        }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=6)
    args = ap.parse_args()
    s = json.loads((ROOT / "migration/input/master-snapshot.json").read_text())
    us = set()
    for row in s["rows"]:
        v = row["values"]
        us.update(urls(v[5]))
        us.update(urls(v[21] if len(v) > 21 else ""))
    out = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as ex:
        for i, r in enumerate(ex.map(check, sorted(us))):
            out.append(r)
            if (i + 1) % 100 == 0:
                print("checked", i + 1, flush=True)
    p = ROOT / "migration/input/source-audit.json"
    p.write_text(
        json.dumps(
            {"checkedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(), "checks": out},
            ensure_ascii=False,
            indent=2,
        )
        + "\n"
    )
    print("done", len(out), flush=True)


if __name__ == "__main__":
    main()
