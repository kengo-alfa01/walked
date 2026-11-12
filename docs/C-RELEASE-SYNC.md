# 日本見風録：C公開データ自動照合の運用

## C公開時の必須手順

1. ⑥最終承認済みの人物・経歴・史跡本文と位置版だけを公開JSONへ反映する。過去版のF/Gを流用しない。
2. 最新の公開JSONを index.html が参照していることを確認する。
3. `node scripts/export-c-release-ledger.cjs` を実行。生成された `data/c-release/records.csv` と `status.csv` を**公開JSONと同じPRに含める**。
4. `node scripts/export-c-release-ledger.cjs --check` を実行する。GitHub Actions `C publication ledger gate` は同じ照合を自動実施する。
5. PRをマージし、GitHub Pages の配信完了後、Google Sheets「C公開自動取込」のIMPORTDATAが公開PagesのCSVを取り込む。
6. 「C公開自動照合」では、GitHub main と Pages のJSON blob SHAの一致を検証し、⑥F=公開OK、⑥J=C候補、⑥K=文章種別、⑥L/M=ID、⑥O=承認版、⑥P=一致を満たすものだけ公開済みと計上する。

## 判定上の注意

- **GitHubに反映**／**Pagesへ配信済み**／**⑥最新版と一致**は異なる状態。Pagesの配信成功が確認できない間は、公開済みにしない。
- Google Sheets IMPORTDATAの外部データ取得には初回だけブラウザで許可が必要となる場合がある。自動再計算には時間差やキャッシュがあり、即時更新は保証されない。
- 取込失敗時は「同期未確認」と表示し、0件・公開済みとは扱わない。
- 史跡本文を承認しても、ピンの公開位置版が未承認なら `public_pin=0` を維持する。
- 台帳には公開コンテンツのID・タイトル・承認版・SHA・ピン公開フラグのみ収録し、正本の内部メモやユーザーコメントを公開しない。
- 承認後のコンテンツJSONの更新、PR作成・マージはCによる作業として残る。⑥の承認だけで自動的にGitHubを更新する仕組みではない。

## 照合元

- C台帳：`data/c-release/records.csv`（全公開人物紹介・長編・経歴・史跡について1ID1行）
- 版証明：`data/c-release/status.csv`（JSONのGit blob SHAと公開件数）
- GitHub main 版：`https://raw.githubusercontent.com/kengo-alfa01/walked/main/data/c-release/status.csv`
- 実配信Pages版：`https://kengo-alfa01.github.io/walked/data/c-release/status.csv` と `records.csv`
- 正本：戦国コンテンツ新正本v2の⑥公開最終承認
