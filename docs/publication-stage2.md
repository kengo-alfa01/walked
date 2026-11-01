# Reviewed publication stage 2 — 2026-11-01 JST

This branch builds on PR #6, commit `17526a259089986671613e67e5dfe435151537e4`. Keep its PR based on `feature/game-publication-stage1-20261031` until PR #6 is approved and merged; then retarget to main without importing its two cards again. No production merge or deployment is authorized. The independent branding PR starts from main `1e3a66aceee0286e4509941deb6d189f62b90b41`.

## Approved runtime changes

| Action | Person and place | Card ID | Approved dates |
| --- | --- | --- | --- |
| Add | 斎藤義龍・岐阜城（稲葉山城） | pub-card-c45fcd74b14d1ad8998e9fd7 | 1554–1561, year precision |
| Add | 斎藤道三・大桑城 | pub-card-d1e5eec3dfb1c80325ed3867 | Unknown; personal visit/residence unconfirmed |
| Update title and summary only | 馬場信春・諏訪原城 | sg-card-0276 | 1573, unchanged |
| Update title and summary only | 武田信玄・箕輪城 | sg-card-0241 | 1566, unchanged |

The live integrated master was read only. All six historical approvals (including the two already in PR #6) were reconciled by review/history/relation/site/card ID. History, site, relation and review states were each confirmed `公開可`; the selected approval fingerprints and text were rechecked before saving. The existing-card updates use the exact conditional S8/S9 before/after JSON and SHA-256 guards from quality handoffs q-s8-suwahara-update and q-s9-minowa-update. They do not add new copies of those cards or change their unlock rules or years.

22 public profiles were projected from 人物公開審査 column AB, with column AC SHA-256 verification. The scope is only approved name, supplied numeric years, independent summary and listed aliases, with source links and credit. Null years stay unknown; there is no fallback to unreviewed legacy biographies, aliases, images or date details. Source notes, unresolved research and raw master rows are excluded. The extra 吉川元春 S14 approval was captured during the final read. Later approvals belong to a later batch.

Only 斎藤義龍 needs a new runtime person row for a new approved card. Existing 530 person rows are unchanged. Two approved profiles (毛利輝元, 小早川隆景) have no current runtime person/card; they remain dormant metadata and do not create collectible cards or appear in the acquired-only list. 20 profiles can attach to current persons, subject to acquisition.

Runtime totals after PR #6 plus this branch: people 531, sites 223, links 235, all cards 306 (234 eligible and 72 existing pending), regional history 20. All existing IDs, visits, acquisition timestamps, title IDs and backup formats are retained. Sites, regional history and the 214-title registry are unchanged. The two text updates affect only their approved fields. GPS-point and manual-area acquisition now commit storage before changing in-memory awards, matching the PR #6 reconciliation safeguard.

## Reproduce and verify

```
node scripts/import-publication-stage2.cjs
node scripts/import-publication-stage2.cjs --write
NODE_PATH=/path/to/test-deps/node_modules WALKED_BROWSER_ASSETS=/path/to/assets node --test tests/publication-import.test.cjs tests/publication-stage2.test.cjs tests/app-integration.test.cjs tests/title-backup.test.cjs
node tests/area-acquisition.test.cjs
```

Use the stage 2 importer for this branch. It verifies the reviewed package checksum, exact pre-update or already-applied update values, the stripped PR #6 baseline, duplicate IDs and reference integrity before writing. Changed baselines/targets/packages stop; replay and partial application are idempotent. The stage 1 tests retain the immutable PR #6 fixture; stage 2 tests verify the current runtime. Do not weaken the baseline checks to accept later unrelated changes.

49 automated tests and the area regression pass. Tests cover old IDs and records, exact guarded updates, profile field allowlist, unknown years, existing/neighboring visits, multiple cards in one municipality, v3 restore/reload, old/unknown cards and timestamps, credits/source DOM, storage-full rollback and retry for all three award paths. Logs are in `docs/checks/publication-stage2/`.

Actual cloud Chrome QA used a disposable local preview containing both proposed branches and a synthetic backup, never the user's production records. Real Leaflet and map boundaries rendered. UI file chooser restored four synthetic municipalities; both new cards unlocked without revisiting. A downloaded v3 backup preserved four visits, both new IDs, the 2002-03-04 existing card timestamp and an unknown 1999 card. Reload retained 14 displayed people/17 eligible cards (18 stored including the unknown card), with no repeated award/title toast. The 義龍 profile displayed unknown birth year, 1561 death year, 1554–1561 tenure and source/CODH credit. This is desktop cloud-browser QA, not an iPhone or live GPS test.

Still unverified: physical iPhone layout and installation/home-screen icon, actual GPS accuracy/permissions, iOS file picker/download/restore, field boundary behavior and offline behavior. Do not mark these tested. No growth, regional encyclopedia, Hachigata correction or unapproved PR #2/#5 data is included. `公開可` remains distinct from `公開済み`; the integration Work alone updates actual publication status after an approved deployment.

Resume: read this file and the management sheet, refresh PR #6 and this branch/main heads, confirm current approvals, then perform iPhone/GPS/iOS-file QA. Obtain the user's explicit approval before any main merge/deployment. Merge PR #6 before retargeting this PR; branding remains a separate review.
