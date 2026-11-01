# Reviewed historical records: first game import

This change adds two independently reviewed events to the runtime Sengoku catalog. It does not replace the person/site masters or import unreviewed research.

| Package | Person / site | Event | Card ID |
| --- | --- | --- | --- |
| 20261031-stage1 | 鳥居元忠 / 上田城跡 | 1585 attack | pub-card-450a5da6b076b67bff0ea854 |
| 20261031-stage4 | 上杉謙信 / 増山城跡 | 1576 capture | pub-card-99565c9c43c63128707e581e |

The frozen S1 output comes from PR #5 commit 74f5faf85e4358fe55573cd046a9089c4824307f. S4 comes from the integration team's 20261031-stage4 export. Before importing, both were regenerated locally with the existing S1 validator. Nine review gates, approval fingerprints, exported JSON checksums, current approved text, and the history/site/relation approval states were checked against the read-only integrated master on 2026-10-31. Only the two approved additive packages are included here; full master snapshots and pending research are excluded.

Baseline: main 1e3a66aceee0286e4509941deb6d189f62b90b41. Person/site records remain 530/223, links increase 232 to 233, cards 302 to 304, regional history remains 20. All old records and IDs remain structurally identical. The existing 1560 Masuyama card sg-card-0266 and the new 1576 event are separate events. The pending Hachigata municipality correction is excluded.

## Import and compatibility

Run `node scripts/import-publication.cjs` for a check, or add `--write` to apply. The importer verifies package checksums and the pinned baseline after removing exact already-applied additions. It rejects modified legacy records and conflicting IDs. Reapplication changes nothing; S1 can be installed before S4. Review baseline changes and obtain a newly reviewed package instead of weakening the hash checks.

The existing startup `reconcileSengokuVisits()` unlocks additions from saved municipality/ward and legacy national-detail visits without another trip. Each card ID is awarded once. Existing acquisition dates, unknown old card IDs, visits and titles are retained. The new acquisition timestamp is the time of evaluation, not an invented historical visit date. Reconciliation now commits storage before changing in-memory awards, so a storage failure leaves both histories unchanged and can be retried.

Acquired card details include the supplied CODH CC BY 4.0 credit, DOI, representative-point limitation, and a clickable primary source. Unacquired events remain hidden. No character growth or rank UI is implemented.

## Verification and remaining checks

42 automated tests pass: importer 4, full application/jsdom 14, title/backup 24, plus area-acquisition regression. Logs are in `docs/checks/publication-stage1/`. Coverage includes every old record, package replay and tampering, current point-in-municipality checks, retroactive unlock, neighbor non-unlock, separate events at one site, repeated startup without duplicate notification, unknown card/date preservation, v3 backup restore, attribution DOM, and storage-full retry. `git diff --check` passes.

Commands:

```
node --test tests/publication-import.test.cjs
node --test tests/title-backup.test.cjs
node tests/area-acquisition.test.cjs
NODE_PATH=/path/to/test-deps/node_modules WALKED_BROWSER_ASSETS=/path/to/assets node --test tests/app-integration.test.cjs
```

The jsdom dependency and pinned boundary assets follow `docs/title-system-stage1.md`. Leaflet rendering is stubbed in these tests: browser rendering, iPhone, GPS and download UI have not been verified in this session. On an isolated test origin, load a copied backup containing 20203 and/or 16208 visits, check awards/credits, reload, export and restore. Do not delete production storage.

Keep this PR Draft and wait for user approval before merging. The integrated master is read-only for the game Work; only its owner records actual publication after deployment. PR #2 and PR #5 remain untouched. Resume from this branch, confirm live main/approved package versions, inspect these tests, and append results to the project management sheet.
