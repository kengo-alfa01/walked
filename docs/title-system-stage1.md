# Stage 1: titles and record protection

The application now awards titles from unique municipality/ward visits, keeps acquired titles after a visit is removed, and lets the player select a profile title. Town records and legacy national-detail aliases count as a single municipality. Map filters do not change title progress. Awards record their first evaluation timestamp; old visit dates are not presented as known historical award dates.

The title catalog has 10 national ranks, four levels for each of 47 prefectures, and two levels for each of eight regions. Prefecture requirements use `ceil(total * percent / 100)`. Regional requirements apply to **every** constituent prefecture. Definitions are in `data/title-rules.json`; the generated target registry is in `data/title-registry.json`. The map and registry use the same pinned upstream boundary revision. Regenerate with `python scripts/build-title-registry.py /path/to/municipalities.topojson` and review the resulting diff.

## Record compatibility

- Existing `walked_municipal_v2` and `walked_sengoku_cards_v1` storage keys remain in use. Titles use `walked_titles_v1`.
- The v3 JSON backup includes visits, all stored card IDs (including unpublished or retired cards), acquired titles, and the selected title. V2 backups still import additively.
- Restore validates the complete document and previews counts before changing records. Conflicts preserve the earliest first/acquisition date, latest last visit, and current profile selection. Unknown IDs are retained for compatibility.
- `walked_before_restore_v1` keeps the last pre-restore/pre-clear backup. Download it from Settings. Restoring it is an additive merge, not an exact rollback of later visits.
- Multi-key restore writes a journal before changing storage. Failed writes roll back. An interrupted restore is recovered before startup loads the game; a remaining journal blocks normal writes.
- Corrupt storage is kept in place and protected from overwriting. Settings can export raw storage for repair; this rescue format is not directly imported as a normal backup.
- The delete action is now explicitly **delete visit records**. Cards and earned titles remain, and a checkpoint is written before deletion.
- The history encyclopedia now recognizes legacy national-detail aliases, matching the shared map keys.
- No character growth/rarity logic was added. Person, site, card and link data are unchanged.

## Validation recorded on 2026-10-31

- `node --test tests/title-backup.test.cjs`: 24 passing tests, covering every threshold, every prefecture and regional requirement, deduplication, retention, validation and storage failures.
- `node tests/area-acquisition.test.cjs`: passing PR #3 regression coverage, extended for legacy-key encyclopedia discovery. Also parses the complete inline application script.
- `tests/app-integration.test.cjs`: 9 passing tests with jsdom, actual application handlers, actual pinned municipality/town topology, and a Leaflet rendering stub. Checks startup, profile/reload, import/export data, cancellation, malformed imports, quota rollback, clearing, corrupt storage, crash recovery, import-lock cleanup, and registry/source hashes.
- `git diff --check`: passed.
- No differences in `sengoku/`, `history.json`, `people-review.csv` or `SCHEMA.md` relative to the PR #3 starting commit.

Logs: [checks/title-backup.txt](checks/title-backup.txt), [checks/area-acquisition.txt](checks/area-acquisition.txt), [checks/app-integration.txt](checks/app-integration.txt).

## Reproduce integration tests

Use Node 24 and install test dependencies outside the application directory, or in a disposable checkout:

```sh
npm install --prefix /tmp/walked-test-deps jsdom@30.1.3 playwright@1.62.1
```

Set `WALKED_BROWSER_ASSETS` to a directory containing:

- `municipalities.topojson` from the `sourceURL` revision recorded in `data/title-registry.json` (the integration test checks its SHA-256).
- `topojson-client.min.js` from `https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js`.

```sh
NODE_PATH=/tmp/walked-test-deps/node_modules WALKED_BROWSER_ASSETS=/path/to/assets node --test tests/app-integration.test.cjs
```

## Browser checks still pending

`tests/browser-stage1.cjs` is provided but has **not passed** in this environment. Browser downloads initially failed; an alternate Chromium build was obtained, but process startup failed at `socket(): Operation not permitted`. WebKit also lacked host dependencies. The jsdom tests do not verify rendering, map gestures, geolocation, browser download behavior, Safari file selection, or viewport fit. No iPhone test is claimed.

To continue in a browser-capable environment, install Playwright browsers, serve the checkout with `python -m http.server 8765`, add Leaflet 1.9.4 `leaflet.js` and `leaflet.css` to the assets directory, and run:

```sh
NODE_PATH=/tmp/walked-test-deps/node_modules WALKED_BROWSER_ASSETS=/path/to/assets node tests/browser-stage1.cjs
```

An optional `CHROMIUM_EXECUTABLE` points at a local Chromium executable. `WALKED_TEST_URL` defaults to `http://127.0.0.1:8765`. The test uses disposable profiles, actual local data and routed external assets. It stubs background tiles and uses a small prefecture rendering fixture; it is not a live-network validation.

Before approval, test on an iPhone with a **copied backup**: nearby/national-detail sharing, normal-view taps, title/profile persistence, timeline and current-location registration, v2/v3 file restore, downloading the pre-restore checkpoint, and long title names at a narrow width. Review the outstanding target/name decisions in the management sheet. Keep the PR Draft until those checks are complete; do not merge automatically.

## Resume

Fetch `feature/title-system-stage1-20261031` and inspect Draft PR #4. Reuse its files and tests. PR #3 is included as its starting commit; do not replace the branch with main or overwrite the separate PR #2 work. Run the recorded checks before extending the implementation. Update the management sheet with the new result and next step after each work session.
