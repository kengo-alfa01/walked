# Isolated Stage 1 preview

The preview is a separate, owner-private Site built from the PR branch. It does not change the public GitHub Pages app. Browser localStorage is isolated by origin; no production storage or user location history is copied into the deployment.

`python scripts/build-preview.py --output /absolute/separate-site/dist` copies only runtime files and adds the `preview/` helper. The public `index.html` does not load this helper. `preview-build.json` records the source commit. Never put the preview output inside the app checkout.

The banner provides a sample with 16 Tokyo and 15 Kanagawa municipality/ward visits. This awards national rank 足軽大将 and each prefecture's first title. It refuses to add samples when real or other test records are already present, and it respects corrupt-storage protection. Reset clears the three game collections only in the preview origin, after confirmation. The normal public app is unchanged.

## iPhone acceptance sequence

1. Open the private preview URL using the same ChatGPT account as its owner. Do not expect it to change the public app or its home-screen icon.
2. Tap サンプルで称号を試す. Confirm 31 national areas, 足軽大将 and the acquired prefecture titles.
3. Choose a different profile title, then reload the same preview URL. Confirm persistence and no duplicate award notification.
4. Download a preview backup. Reset only the preview's test records, then restore that downloaded file and verify visits, cards and selected title.
5. To try real records, first reset sample data. Save a backup from the public app and import a **copy** into the preview. Old v2 files contain visits only: they cannot transfer all existing card acquisition records. Do not delete the public browser's storage.
6. Check current-location registration, map modes, normal-view taps, narrow-width layout and timeline import on the device. If location permission is needed, the user grants it on their own iPhone.

## Verification limits

The two preview-specific integration tests pass with the complete application in jsdom; the total application integration suite is now 11 tests. Pure rules/backups remain 24 passing tests, plus the existing area-acquisition suite. The managed browser connection timed out in this environment. This is not a passed browser or iPhone rendering test. The previously supplied browser test runner remains available for a browser-capable environment.

Keep the Site private and PR #4 Draft. Record the deployed URL and device test results in the management sheet; do not copy private management notes into this repository.
