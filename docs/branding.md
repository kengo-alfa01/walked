# 日本見風録 branding — 2026-11-01 JST

Independent Draft PR based on main `1e3a66aceee0286e4509941deb6d189f62b90b41`. The previous Work left uncommitted changes; they were inspected and reused, not assumed complete from the empty remote branch. This change includes no historical catalog import.

Title/header/logo, application and Apple web-app titles, favicon, Apple touch icon, manifest name/short_name and user-facing backup filenames now use 日本見風録（にっぽんけんぷうろく）. The original storage keys, v2/v3 backup identifiers, restore journal/checkpoint keys, repository and public URL remain unchanged. The backup error text retains 旧WALKED to explain compatibility.

The selected first image (navy/gold, large GPS pin, open book, Fuji, cherry blossoms, map and Japanese pattern) was recovered and byte-matched to the previous Work's file. Original SHA-256: `677190a90816a19ab61d88b6bd865815cf1d4fe6355a17d34a0c079dc4f74e46`. The second design with a red dotted route was not used. Runtime PNG exports are faithful resizes only: 32 favicon,180 Apple touch,192 header/manifest and512 manifest. The full 3MB source is not duplicated in the public repository.

Manifest id/start_url/scope are relative `./`; display standalone. No repository rename, storage migration, paid service, app-store publication or offline support is introduced. The generic preview packager records the actual branch and supports optional runtime assets, so its exact same version can coexist with the separate data PR.

35 existing application/title/backup tests and area regression passed. PNG sizes/formats, all HTML/manifest icon paths, packaged files, storage-key identity and unchanged historical datasets were checked. A real cloud Chrome preview rendered the title/icon and map; a combined preview also passed real UI file restore/export and reload checks documented in the data PR. `docs/checks/branding/desktop.jpg` is that synthetic-record preview, not production. Tests/logs and visual evidence are separate from device QA.

Follow-up actual Chrome iframe viewport checks at 320/390/430px found no horizontal overflow, including the combined acquired profile/timeline/source view. This checks CSS responsiveness in desktop Chrome, not mobile hardware, touch behavior or Safari.

Still unverified: physical iPhone responsive rendering, Add to Home Screen/icon caching, actual GPS, Safari/iOS file UI. Existing installed shortcuts may need a user-side refresh/re-add, but this has not been tested. Main and the live app were not changed or deployed. Keep this PR Draft until the user explicitly approves merging/publishing. No title growth or regional encyclopedia feature is added.

Resume from this branch, read current management sheet and PR state, then perform iPhone/installation/GPS/file QA. Data PR #6 and its follow-up are reviewed independently. Verify the combined merge without modifying main, and request deployment approval only after the reviewable changes are ready.
