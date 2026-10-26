import copy, csv, json, pathlib, sys, tempfile, unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from generate_sengoku_master import generate, load, dump, read_source, reviewed_year
from validate_sengoku_master import validate


class MigrationTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.p = pathlib.Path(self.temp.name)
        self.source = load(ROOT / "migration/input/master-snapshot.json")

    def tearDown(self):
        self.temp.cleanup()

    def run_source(self, s, out="out"):
        dump(self.p / "source.json", s)
        return generate(self.p / "source.json", self.p / out)

    def test_full_dataset_and_zero_structural_orphans(self):
        self.run_source(self.source)
        self.assertEqual(validate(self.p / "out")["failed"], 0)

    def test_reproducibility_same_input_bytes(self):
        self.run_source(self.source, "a")
        self.run_source(self.source, "b")
        a = self.p / "a"
        b = self.p / "b"
        self.assertEqual(
            {p.name: p.read_bytes() for p in a.iterdir()},
            {p.name: p.read_bytes() for p in b.iterdir()},
        )

    def test_id_stable_when_row_order_changes(self):
        self.run_source(self.source, "a")
        s = copy.deepcopy(self.source)
        s["rows"].reverse()
        self.run_source(s, "b")
        f = lambda d: {p["masterKey"]: p["id"] for p in load(self.p / d / "people.json")}
        self.assertEqual(f("a"), f("b"))

    def test_renaming_never_changes_id_and_is_flagged(self):
        self.run_source(self.source, "a")
        s = copy.deepcopy(self.source)
        s["rows"][0]["values"][0] += "（確認用）"
        self.run_source(s, "b")
        a = load(self.p / "a/people.json")[0]
        b = load(self.p / "b/people.json")[0]
        self.assertEqual(a["id"], b["id"])
        self.assertIn("name_changed_identity_review_required", b["qualityIssues"])

    def test_changed_master_invalidates_prior_review(self):
        s = copy.deepcopy(self.source)
        row = next(r for r in s["rows"] if r["values"][0] == "織田信長")
        row["values"][4] = "変更された事績。"
        self.run_source(s)
        p = next(p for p in load(self.p / "out/people.json") if p["name"] == "織田信長")
        self.assertEqual(p["fieldStatus"]["biography"], "unverified")
        self.assertIn("prior_review_stale_master_changed", p["qualityIssues"])

    def test_same_alias_distinct_people_remain_separate(self):
        self.run_source(self.source)
        ps = load(self.p / "out/people.json")
        a = next(p for p in ps if p["selection"]["rosterId"] == "1046")
        b = next(p for p in ps if p["selection"]["rosterId"] == "1053")
        self.assertNotEqual(a["id"], b["id"])
        self.assertIn("島津家久", b["aliases"])
        self.assertEqual(a["birth"]["value"], 1547)
        self.assertEqual(b["birth"]["value"], 1576)

    def test_duplicate_key_rejected(self):
        self.source["rows"].append(copy.deepcopy(self.source["rows"][0]))
        self.source["selectionCounts"]["selected"] += 1
        with self.assertRaisesRegex(ValueError, "duplicate"):
            self.run_source(self.source)

    def test_unregistered_new_id_rejected(self):
        self.source["rows"][0]["values"][8] = "99999"
        with self.assertRaisesRegex(ValueError, "new key"):
            self.run_source(self.source)

    def test_excluding_linked_person_preserves_cards_and_archive(self):
        s = copy.deepcopy(self.source)
        row = next(r for r in s["rows"] if r["values"][0] == "織田信長")
        s["rows"].remove(row)
        s["excluded"].append(
            {"name": row["values"][0], "rosterId": row["values"][8], "decision": "登録しない"}
        )
        s["selectionCounts"]["selected"] -= 1
        s["selectionCounts"]["excluded"] += 1
        self.run_source(s)
        active = load(self.p / "out/people.json")
        archive = load(self.p / "out/people-archive.json")
        self.assertFalse(any(p["name"] == "織田信長" for p in active))
        self.assertTrue(any(p["name"] == "織田信長" for p in archive))
        self.assertEqual(len(load(self.p / "out/cards.json")), 302)
        self.run_source(self.source, "restored")
        self.assertEqual(
            next(p["id"] for p in active if p["name"] == "徳川家康"),
            next(p["id"] for p in load(self.p / "restored/people.json") if p["name"] == "徳川家康"),
        )

    def test_dangling_reference_detected(self):
        self.run_source(self.source)
        d = load(self.p / "out/cards.json")
        d[0]["personId"] = "missing"
        dump(self.p / "out/cards.json", d)
        r = validate(self.p / "out")
        self.assertGreater(r["failed"], 0)

    def test_unverified_facts_block_release(self):
        self.run_source(self.source)
        r = validate(self.p / "out", release=True)
        self.assertGreater(r["failed"], 0)
        self.assertIn("release: all facts independently reviewed", r["errors"])

    def test_birth_dispute_is_not_chosen(self):
        self.run_source(self.source)
        p = next(p for p in load(self.p / "out/people.json") if p["name"] == "明智光秀")
        self.assertIsNone(p["birth"]["value"])
        self.assertEqual(p["birth"]["candidates"], [1516, 1528])
        self.assertNotEqual(p["verification"], "verified")

    def test_csv_export_has_same_selected_ids(self):
        headers = self.source["headers"]
        rows = {r["sheetRow"]: r["values"] for r in self.source["rows"]}
        with (self.p / "master.csv").open("w", encoding="utf-8-sig", newline="") as f:
            w = csv.writer(f)
            w.writerow(headers)
            w.writerows(rows.values())
        generate(self.p / "master.csv", self.p / "csv")
        self.run_source(self.source)
        a = lambda d: {p["masterKey"]: p["id"] for p in load(self.p / d / "people.json")}
        self.assertEqual(a("csv"), a("out"))

    def test_source_http_check_never_promotes_facts(self):
        self.run_source(self.source)
        ps = load(self.p / "out/people.json")
        self.assertTrue(all(p["verification"] == "needs_review" for p in ps))
        self.assertTrue(all(p["fieldStatus"]["aliases"] == "unverified" for p in ps))

    def test_verified_correction_preserves_unknown_master_text(self):
        self.run_source(self.source)
        p = next(p for p in load(self.p / "out/people.json") if p["name"] == "服部半蔵")
        self.assertEqual(p["death"]["value"], 1596)
        self.assertEqual(p["death"]["raw"], "未確認")
        self.assertEqual(p["death"]["status"], "verified")
        self.assertIsNone(p["birth"]["value"])
        self.assertEqual(p["birth"]["candidates"], [1542])

    def test_unverified_correction_and_disputed_single_year_are_not_promoted(self):
        d = reviewed_year("未確認", "birth", {"confirmedBirthValue": 1542}, "unverified")
        self.assertIsNone(d["value"])
        self.assertEqual(d["candidates"], [1542])
        self.assertIsNone(reviewed_year("1536", "birth", {}, "disputed")["value"])

    def test_delta_preserves_previous_612_ids_and_reviews_added_twelve(self):
        import hashlib

        self.run_source(self.source)
        delta = load(ROOT / "migration/reports/selection-delta-612-to-624.json")
        added = {p["rosterId"] for p in delta["added"]}
        ps = load(self.p / "out/people.json")
        previous = {
            p["masterKey"]: p["id"] for p in ps if p["masterKey"] in delta["previousMasterKeys"]
        }
        digest = hashlib.sha256(json.dumps(previous, sort_keys=True).encode()).hexdigest()
        self.assertEqual(len(previous), 612)
        self.assertEqual(digest, delta["previousIdMappingSha256"])
        new = [p for p in ps if p["selection"]["rosterId"] in added]
        self.assertEqual(len(new), 12)
        self.assertTrue(all(50 <= len(p["biography"]) <= 100 for p in new))
        self.assertTrue(all(p["fieldStatus"]["biography"] == "verified" for p in new))
        self.assertTrue(all(p["verification"] == "needs_review" for p in new))


if __name__ == "__main__":
    unittest.main()
