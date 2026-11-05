#!/usr/bin/env python3
"""Generate a reviewable, deterministic dataset; never write to live sengoku/.
Input: connector snapshot or CSV export from the exact 人物データ sheet.
Existing roster keys stay in the version-controlled registry even when excluded.
"""

import argparse, collections, csv, hashlib, json, pathlib, re, unicodedata, urllib.parse

ROOT = pathlib.Path(__file__).resolve().parents[1]


def load(p):
    return json.loads(pathlib.Path(p).read_text(encoding="utf-8"))


def dump(p, x):
    p = pathlib.Path(p)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(x, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def norm(s):
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", s))


def urls(s):
    return list(dict.fromkeys(re.findall(r"https?://[^\s<>]+", s or "")))


def csvout(p, rows, fields):
    p = pathlib.Path(p)
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields, lineterminator="\n")
        w.writeheader()
        for r in rows:
            w.writerow(
                {
                    k: (
                        json.dumps(r.get(k), ensure_ascii=False)
                        if isinstance(r.get(k), (list, dict))
                        else r.get(k, "")
                    )
                    for k in fields
                }
            )


def year(raw):
    raw = str(raw or "")
    return {
        "value": int(raw) if re.fullmatch(r"\d{4}", raw) else None,
        "raw": raw,
        "candidates": sorted(set(map(int, re.findall(r"(?<!\d)\d{4}(?!\d)", raw)))),
        "status": "unverified",
    }


def reviewed_year(raw, field, review, status):
    """Keep sheet text and uncertainty; only a verified explicit correction sets value."""
    date = year(raw)
    correction = review.get("confirmed" + field.title() + "Value")
    additional = review.get("additional" + field.title() + "Candidates", [])
    if correction is not None:
        if type(correction) is not int or not 1000 <= correction <= 2100:
            raise ValueError("invalid confirmed year")
        additional = additional + [correction]
        if status == "verified":
            date["value"] = correction
    date["candidates"] = sorted(set(date["candidates"] + additional))
    date["status"] = status
    # Candidate history includes preserved master values and other calendar bases.
    # Only an explicit, independently verified result may resolve that history.
    resolved = correction is not None and status == "verified"
    if (len(date["candidates"]) > 1 and not resolved) or status in {"disputed", "calendar_basis_requires_review"}:
        date["value"] = None
    return date


def alias_candidates(raw):
    # Preserve uncertainty as raw text; never equate matching short names with identity.
    s = re.sub(r"(Wikipedia|記事名|通称|法号|雅号|斎号|受領名|号|あだ名|渾名)[：:]", "", raw or "")
    s = re.sub(r"[（(][^）)]*[）)]", "", s)
    return sorted(
        {
            x.strip()
            for x in re.split(r"[、・\n→/／]", s)
            if 1 < len(x.strip()) < 32
            and x.strip() not in {"未確認", "不詳"}
            and not any(t in x for t in ["諸説", "異説", "?", "？", "『", "とされ"])
        }
    )


def read_source(p):
    if pathlib.Path(p).suffix.lower() == ".csv":
        with open(p, encoding="utf-8-sig", newline="") as f:
            rs = list(csv.reader(f))
        if rs[0][:9] != [
            "人物名",
            "別名・通称",
            "生年",
            "没年",
            "何をした人物か（50〜100字）",
            "出典URL",
            "調査状況",
            "登録判断",
            "取得名簿ID（非公式）",
        ]:
            raise ValueError("unexpected sheet/headers")
        rows = [{"sheetRow": i + 2, "values": v} for i, v in enumerate(rs[1:]) if any(v)]
        for r in rows:
            if len(r["values"]) < 9 or r["values"][7] not in ["登録する", "登録しない"]:
                raise ValueError("invalid decision")
        return {
            "rows": [r for r in rows if r["values"][7] == "登録する"],
            "excluded": [
                {
                    "sheetRow": r["sheetRow"],
                    "name": r["values"][0],
                    "rosterId": r["values"][8],
                    "decision": r["values"][7],
                }
                for r in rows
                if r["values"][7] != "登録する"
            ],
            "totalRows": len(rows),
            "selectionCounts": {
                "selected": sum(r["values"][7] == "登録する" for r in rows),
                "excluded": sum(r["values"][7] == "登録しない" for r in rows),
            },
        }
    return load(p)


def generate(source, out, registry_path=None):
    s = read_source(source)
    out = pathlib.Path(out)
    out.mkdir(parents=True, exist_ok=True)
    registry = load(registry_path or ROOT / "migration/input/id-registry.json")
    review = load(ROOT / "migration/input/research-review.json")
    backup = ROOT / "migration/backup"
    old = load(backup / "people.json")
    sites = load(backup / "sites.json")
    cards = load(backup / "cards.json")
    links = load(backup / "links.json")
    history = load(backup / "history.json")
    old_byid = {p["id"]: p for p in old}
    checks = (
        load(ROOT / "migration/input/source-audit.json")["checks"]
        if (ROOT / "migration/input/source-audit.json").exists()
        else []
    )
    http = {c["url"]: c for c in checks}
    people = []
    seen = set()
    mapping = {}
    audit = []
    review_bykey = review["people"]
    raw_rows = {}
    for r in s["rows"]:
        v = [str(x or "") for x in r["values"]] + [""] * 23
        k = v[8]
        if v[7] != "登録する":
            raise ValueError("snapshot contains unselected row")
        if not k or k in seen:
            raise ValueError("duplicate/missing roster key " + k)
        seen.add(k)
        raw_rows[k] = v
        reg = registry.get(k)
        if not reg:
            raise ValueError(
                "new key " + k + ": run register_master_ids.py explicitly before generating"
            )
        if any(i not in old_byid for i in reg["oldIds"]):
            raise ValueError("unknown legacy ID")
        for i in reg["oldIds"]:
            if i in mapping:
                raise ValueError("legacy ID maps twice " + i)
            mapping[i] = reg["id"]
        sources = urls(v[5])
        rv = review_bykey.get(k, {})
        evidence_sha = hashlib.sha256(
            json.dumps(v[:7] + v[9:16] + v[20:22], ensure_ascii=False).encode()
        ).hexdigest()
        stale = bool(rv) and rv.get("masterEvidenceSha256") != evidence_sha
        if stale:
            rv = {}
        summary = rv.get("biography", v[4])
        candidate = alias_candidates(v[1])
        verified_aliases = rv.get("verifiedAliases", [])
        field_status = {
            "name": "unverified",
            "reading": "unverified",
            "group": "legacy_unverified",
            "aliases": "unverified",
            "birth": "unverified",
            "death": "unverified",
            "biography": "unverified",
            "biographyQuality": "unverified",
            "identity": "unverified",
            "sourceRelevance": "unverified",
            "license": "requires_review",
        }
        field_status.update(rv.get("fieldStatus", {}))
        birth = reviewed_year(v[2], "birth", rv, field_status["birth"])
        death = reviewed_year(v[3], "death", rv, field_status["death"])
        issues = ["full_historical_review_pending", "alias_identity_review_pending"]
        if stale:
            issues.append("prior_review_stale_master_changed")
        if any(t in v[11] for t in ["機械整理", "基本プロフィール"]):
            issues.append("mechanical_biography_rewrite_needed")
        if "biography" in rv:
            issues = [i for i in issues if i != "mechanical_biography_rewrite_needed"]
        if not 50 <= len(summary) <= 100:
            issues.append("biography_length_outside_50_100")
        if birth["value"] is None or death["value"] is None:
            issues.append("unknown_or_disputed_year_preserve_raw")
        if any(t in v[13] for t in ["別人", "混同", "架空", "創作"]):
            issues.append("identity_or_legend_caution_in_source_notes")
        if v[0] != reg["nameAtRegistration"]:
            issues.append("name_changed_identity_review_required")
        all_sources = list(dict.fromkeys(rv.get("sources", []) + sources + urls(v[21])))
        httpbad = [u for u in all_sources if u in http and http[u].get("status") != 200]
        if httpbad:
            issues.append("source_http_unavailable")
        prior = old_byid.get(reg["id"], {})
        p = {
            "id": reg["id"],
            "masterKey": "roster:" + k,
            "name": v[0],
            "reading": v[9],
            "group": prior.get("group", ""),
            "aliases": verified_aliases,
            "aliasCandidates": candidate,
            "aliasesRaw": v[1],
            "birth": birth,
            "death": death,
            "biography": summary,
            "verification": (
                "verified"
                if all(x == "verified" for x in field_status.values())
                else "needs_review"
            ),
            "fieldStatus": field_status,
            "siteResearch": prior.get("siteResearch", "not_started"),
            "source": all_sources[0] if all_sources else "",
            "sources": all_sources,
            "sourceStatus": "partially_content_checked" if rv else "unverified",
            "sourceAssertions": {
                "researchStatus": v[6],
                "yearStatus": v[10],
                "biographyStatus": v[11],
                "identityStatus": v[12],
            },
            "notes": v[13],
            "license": {
                "status": rv.get("licenseStatus", "requires_review"),
                "attribution": v[20],
                "derivedDatasetLicense": "CC-BY-SA-4.0 (conservative for Wikipedia-derived portions)",
                "imageReuse": False,
            },
            "researchReview": rv,
            "qualityIssues": issues,
            "selection": {"decision": v[7], "sheetRow": r["sheetRow"], "rosterId": k},
        }
        people.append(p)
        audit.append(
            {
                "id": p["id"],
                "rosterId": k,
                "name": p["name"],
                "overallStatus": "未完了",
                "fieldStatus": field_status,
                "biography": summary,
                "biographyLength": len(summary),
                "issues": issues,
                "sourceUrls": all_sources,
                "unavailableUrls": httpbad,
                "priorSheetStatus": v[6],
                "reviewNotes": rv.get("note", ""),
            }
        )
    if len(people) != s["selectionCounts"]["selected"]:
        raise ValueError("selection count mismatch")
    if len({p["id"] for p in people}) != len(people):
        raise ValueError("ID collision")
    if len({norm(p["name"]) for p in people}) != len(people):
        raise ValueError("duplicate representative name: resolve identity before generating")
    selected_ids = {p["id"] for p in people}
    referenced = {r["personId"] for r in links + cards}
    archive_ids = referenced - set(mapping)
    archive = [
        dict(
            p,
            active=False,
            archiveReason="not_selected_or_not_in_master; kept solely for legacy card references",
        )
        for p in old
        if p["id"] in archive_ids
    ]
    known = selected_ids | {p["id"] for p in archive}
    transformed = {}
    impacts = []
    for table, rows in [("cards", cards), ("links", links)]:
        data = []
        for row in rows:
            r = dict(row)
            new = mapping.get(r["personId"], r["personId"])
            action = (
                "unchanged_selected"
                if new in selected_ids and new == r["personId"]
                else "remapped_selected" if new in selected_ids else "legacy_archive"
            )
            if new not in known:
                raise ValueError("unresolved " + new)
            impacts.append(
                {
                    "table": table,
                    "id": r["id"],
                    "siteId": r["siteId"],
                    "oldPersonId": r["personId"],
                    "newPersonId": new,
                    "action": action,
                    "policy": "preserve_id_content_acquisition; legacy people excluded from new master",
                }
            )
            r["personId"] = new
            data.append(r)
        transformed[table] = data
    oldmap = []
    selected_names = {norm(p["name"]) for p in people}
    excluded_names = {norm(r["name"]) for r in s["excluded"]}
    for p in old:
        new = mapping.get(p["id"])
        status = (
            "mapped_selected"
            if new
            else "excluded_by_H" if norm(p["name"]) in excluded_names else "not_in_selected_master"
        )
        oldmap.append(
            {
                "oldId": p["id"],
                "oldName": p["name"],
                "newId": new,
                "status": status,
                "referenceArchive": p["id"] in archive_ids,
                "historicalIdentityStatus": "unverified",
                "cardCount": sum(c["personId"] == p["id"] for c in cards),
                "linkCount": sum(l["personId"] == p["id"] for l in links),
            }
        )
    aliasindex = collections.defaultdict(set)
    for p in people:
        for token in [p["name"], p["reading"]] + p["aliases"] + p["aliasCandidates"]:
            if token:
                aliasindex[norm(token)].add(p["id"])
    collisions = [
        {"token": k, "personIds": sorted(v), "status": "candidate_only_do_not_merge"}
        for k, v in sorted(aliasindex.items())
        if len(v) > 1
    ]
    for p in people:
        for t in p["aliasCandidates"]:
            if norm(t) in selected_names and norm(t) != norm(p["name"]):
                collisions.append(
                    {
                        "token": t,
                        "personIds": sorted(aliasindex[norm(t)]),
                        "status": "canonical_name_collision_do_not_merge",
                    }
                )
    stats = {
        "selected": len(people),
        "historicalReviewComplete": sum(p["verification"] == "verified" for p in people),
        "needsHistoricalReview": sum(p["verification"] != "verified" for p in people),
        "peopleWithPartialFieldContentReview": sum(bool(p["researchReview"]) for p in people),
        "biographyContentReviewedThisRun": sum(
            p["fieldStatus"]["biography"] == "verified" for p in people
        ),
        "mechanicalBiographyRewriteNeeded": sum(
            "mechanical_biography_rewrite_needed" in p["qualityIssues"] for p in people
        ),
        "aliasIdentityUnreviewedPeople": sum(
            p["fieldStatus"]["aliases"] != "verified" or p["fieldStatus"]["identity"] != "verified"
            for p in people
        ),
        "aliasCollisionGroups": len(collisions),
        "oldPeople": len(old),
        "oldIdsMappedToSelected": len(mapping),
        "selectedWithOldId": sum(
            bool(registry[p["selection"]["rosterId"]]["oldIds"]) for p in people
        ),
        "newPeople": sum(not registry[p["selection"]["rosterId"]]["oldIds"] for p in people),
        "archivePeople": len(archive),
        "sites": len(sites),
        "cards": len(cards),
        "links": len(links),
        "historyEntries": len(history["entries"]),
        "naiveReplacementBrokenCardReferences": sum(
            c["personId"] not in selected_ids for c in cards
        ),
        "naiveReplacementBrokenLinkReferences": sum(
            l["personId"] not in selected_ids for l in links
        ),
        "remainingStructuralDanglingReferences": 0,
        "requiresRealDeviceTest": True,
        "releaseReady": False,
    }
    outputs = {
        "people": people,
        "people-archive": archive,
        "sites": sites,
        "cards": transformed["cards"],
        "links": transformed["links"],
        "history": history,
        "id-map": oldmap,
        "search-index": {k: sorted(v) for k, v in sorted(aliasindex.items())},
        "alias-collisions": collisions,
        "quality-audit": audit,
        "impacts": impacts,
        "unresolved-references": [],
        "summary": stats,
    }
    for k, v in outputs.items():
        dump(out / (k + ".json"), v)
    human = [
        {
            "名簿ID": p["selection"]["rosterId"],
            "人物ID": p["id"],
            "人物名": p["name"],
            "登録判断": "登録する",
            "別名（確認済みの一部）": p["aliases"],
            "別名候補（未確認）": p["aliasesRaw"],
            "生年（正本原文）": p["birth"]["raw"],
            "没年（正本原文）": p["death"]["raw"],
            "生年候補": p["birth"]["candidates"],
            "没年候補": p["death"]["candidates"],
            "略歴": p["biography"],
            "全体確認": "未完了" if p["verification"] != "verified" else "確認済み",
            "事績確認": p["fieldStatus"]["biography"],
            "項目別状態": p["fieldStatus"],
            "今回の確認メモ": p["researchReview"].get("note", ""),
            "出典URL": p["sources"],
            "利用条件": p["license"]["attribution"],
            "残課題": p["qualityIssues"],
        }
        for p in people
    ]
    csvout(
        out / "selected-people.csv",
        human,
        list(human[0]) if human else ["名簿ID", "人物ID", "人物名"],
    )
    corrections = [
        {
            "名簿ID": p["selection"]["rosterId"],
            "人物名": p["name"],
            "正本の略歴": raw_rows[p["selection"]["rosterId"]][4],
            "移行候補の略歴": p["biography"],
            "出典": p["researchReview"]["sources"],
            "留意事項": p["researchReview"]["note"],
            "正本変更": "未実施",
        }
        for p in people
        if "biography" in p["researchReview"]
    ]
    csvout(
        out / "biography-revisions.csv",
        corrections,
        ["名簿ID", "人物名", "正本の略歴", "移行候補の略歴", "出典", "留意事項", "正本変更"],
    )
    csvout(
        out / "quality-audit.csv",
        audit,
        [
            "rosterId",
            "id",
            "name",
            "overallStatus",
            "fieldStatus",
            "biography",
            "biographyLength",
            "issues",
            "sourceUrls",
            "unavailableUrls",
            "priorSheetStatus",
            "reviewNotes",
        ],
    )
    csvout(
        out / "id-map.csv",
        oldmap,
        [
            "oldId",
            "oldName",
            "newId",
            "status",
            "referenceArchive",
            "historicalIdentityStatus",
            "cardCount",
            "linkCount",
        ],
    )
    csvout(
        out / "impacts.csv",
        impacts,
        ["table", "id", "siteId", "oldPersonId", "newPersonId", "action", "policy"],
    )
    csvout(out / "alias-collisions.csv", collisions, ["token", "personIds", "status"])
    dump(
        out / "provenance.json",
        {
            "masterInputSha256": hashlib.sha256(pathlib.Path(source).read_bytes()).hexdigest(),
            "registrySha256": hashlib.sha256(
                pathlib.Path(
                    registry_path or ROOT / "migration/input/id-registry.json"
                ).read_bytes()
            ).hexdigest(),
            "researchReviewSha256": hashlib.sha256(
                (ROOT / "migration/input/research-review.json").read_bytes()
            ).hexdigest(),
            "sourceAuditSha256": (
                hashlib.sha256(
                    (ROOT / "migration/input/source-audit.json").read_bytes()
                ).hexdigest()
                if (ROOT / "migration/input/source-audit.json").exists()
                else None
            ),
            "identityConstraintsSha256": hashlib.sha256(
                (ROOT / "migration/input/identity-constraints.json").read_bytes()
            ).hexdigest(),
            "backupManifest": load(backup / "manifest.json"),
            "source": "https://docs.google.com/spreadsheets/d/1zAsYOk43BnP5v1NCPDbupN2GJkk-Y-zpgevkwt4MD_Q/edit",
            "decision": "H == 登録する; no inference from old roster",
            "identityReview": "Technical mapping does not imply full historical verification",
        },
    )
    return stats


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", default=str(ROOT / "migration/input/master-snapshot.json"))
    ap.add_argument("--out", default=str(ROOT / "migration/generated"))
    a = ap.parse_args()
    print(json.dumps(generate(a.input, a.out), ensure_ascii=False, indent=2))
