# C：戦国・地域図鑑の承認済み差分（2026-11-02）

対象は戦国と地域図鑑のみ。mainマージ・本番公開は未実施。報告後のユーザー承認が必要。

## 基準と取得時点

基準mainは `3abcb77f7ee3c53c8837ce85bef4bf8b78ea58d4`（PR #9まで本番公開済み）。open Draft PR #2/#5は読取のみ。
正本取得は `2026-11-02T13:51:21.980Z`（22:51 JST）。最終再取得23:05 JSTで審査・人物審査・地域記事・対応・出典の取得値とmainに変化なし。

戦国は公開審査41公開可・人物審査36公開可。関連する歴史41/史跡29/関連41の公開可を確認。取得時点のB結果ステージは空（その後の研究進捗を指さない）。公開可候補・基本調査完了・調査中を取込条件にしない。
地域図鑑は候補878（登録875）、公開可439記事447対応、公開済み19記事20対応、審査待ち138、調査中282。旧報告件数を固定値にしない。
研究マスターは読取のみ。公開用の独自文章・ID・承認メタデータ・出典情報・権利確認済み座標だけを投影し、原票・未審査プロフィール・画像・原文等は保存しない。

## 差分

|対象|追加|更新|適用後|
|---|---:|---:|---:|
|戦国カード|16|6|322（公開対象250／既存待ち72）|
|人物ゲーム行|1（黒田官兵衛）|0|532|
|史跡ゲーム行|10|4|233|
|人物史跡リンク|14|1|249|
|承認範囲の人物紹介|14|0|36|
|地域図鑑記事|439|0|458|
|自治体対応|447|0|467|
|地域図鑑出典|400|0|420|

地域図鑑の既配信19記事20対応は変更なし。JSON内のpublicationStatusは取込時の承認ラベルで、本番公開済みを示さない。配信台帳は研究正本・管理シートで別管理。未収録人物の承認紹介は休眠メタデータで、カードを作らない。
画面・保存キー・獲得条件・既存ID・バックアップv3・称号214種を変更しない。地域図鑑は保存済み訪問から導出し再訪不要。人物カードは既存戦国処理を継続。成長機能、旧歴史図鑑UI整理、検索改善、幕末・明治は対象外。

## 戦国の承認照合

候補SHA・凍結パッケージSHA・before/after SHAを、原指示のUTF-8 JSON.stringify（元のプロパティ順）で確認後に投影。S31はS43統合bundleに含め単独S31を重複投入しない。
S51/S52/S53は承認行の指紋を記録し、提供済みパッケージSHA・承認行の版/ID/題名/説明文の一致・after SHAで照合。承認行指紋とパッケージSHAは別物で、同じハッシュとは報告しない。最小証跡はpackage.jsonのapprovals/operations.proof。研究原票や完全研究bundleは保存しない。

|審査ID|カードID|操作|
|---|---|---|
|review-29a090949790bead99b9|pub-card-4f1c4ce6c4032d79509d41df|追加|
|review-c88ec213ae959d3d9319|sg-card-0124|更新|
|review-1bd34c8168a423457593|sg-card-0116|更新|
|review-s25-sanada-ueda-1600|sg-card-0136|更新|
|review-s25-nobunaga-gifu-1567|sg-card-0263|更新|
|review-s26-hideyoshi-ishigaki|sg-card-0013|更新|
|review-s27-masamune-sendai1601|pub-card-10fd0fdf782191833353a8b2|追加|
|review-s28-kuroda-gifu1575|pub-card-460bdaf0819d55b42fcc8742|追加|
|review-s31-motonari-koriyama1523|pub-card-268571ea41feac148a4784f9|追加|
|review-s32-hideyoshi-gifu1583|pub-card-32c40118e5c56bdabf6f8b54|追加|
|review-s33-ieyasu-nijo1603|pub-card-96e550e9238b8578b795332b|追加|
|review-s34-ujiyasu-odawara1541|sg-card-0003|更新|
|review-s35-sanada-osaka1614|pub-card-2f1e3b45925e179885ad4f59|追加|
|review-s37-nobu-okehazama-toyoake1560|pub-card-d22eb5293ce63110515a4fb5|追加|
|review-s38-hideyoshi-osaka-build-1583|pub-card-0c318c0eb745561e04ca5a16|追加|
|review-s43-motonari-koriyama1540|pub-card-c7757200eb6cb07049500403|追加|
|review-s43-motonari-koriyama1571|pub-card-18142cf5ecc680edce957807|追加|
|review-s44-motonari-toda1565|pub-card-d81b19a9a3008170f75d2369|追加|
|review-s44-motonari-niitakayama1561|pub-card-c9fed945d7ac483847b2c2b2|追加|
|review-s51-motonari-sarukake1500|pub-card-9522e5a0f5d8cc4c0d65003c|追加|
|review-s52-kenshin-kasugayama1548|pub-card-s52-kenshin-kasugayama1548|追加|
|review-s53-masamune-zuiganji1609|pub-card-a0fb0e8cd73aba791774cbfc|追加|

## 除外・保留

main既存の6承認は再投入しない。川中島1561・小田原1561の2承認は「既存カードを変更しない」ため差分ゼロ。以下11承認は公開可だがJSONとの対応を十分検証できず保留。Cは正本の指紋を新規作成・承認補完しない。

|審査ID|理由|
|---|---|
|review-s54-kenshin-rinsenji1536|指紋は存在するが公開JSONとの照合方式/対象が未提示。推測補完せず保留|
|review-s60-shingen-uehara1542|指紋は存在するが公開JSONとの照合方式/対象が未提示。S60のJSONには承認説明文も未収載。推測補完せず保留|
|review-s60-shingen-kuwabara1542|指紋は存在するが公開JSONとの照合方式/対象が未提示。S60のJSONには承認説明文も未収載。推測補完せず保留|
|review-s61-kenshin-nanao1577|正本の承認指紋が空欄。公開可候補ではなく公開可だが、指紋付き凍結版の再引継ぎが必要|
|review-s62-kenshin-nanao1576|正本の承認指紋が空欄。公開可候補ではなく公開可だが、指紋付き凍結版の再引継ぎが必要|
|review-s65-maeda-nanao1581|正本の承認指紋が空欄。公開可候補ではなく公開可だが、指紋付き凍結版の再引継ぎが必要|
|review-s68-kuroda-umagatake1587|正本の承認指紋が空欄。公開可候補ではなく公開可だが、指紋付き凍結版の再引継ぎが必要|
|review-s68-hideyoshi-umagatake1587|正本の承認指紋が空欄。公開可候補ではなく公開可だが、指紋付き凍結版の再引継ぎが必要|
|review-s71-kuroda-arioka1578|正本の承認指紋が空欄。公開可候補ではなく公開可だが、指紋付き凍結版の再引継ぎが必要|
|review-s71-kuroda-arioka-rescue1579|正本の承認指紋が空欄。公開可候補ではなく公開可だが、指紋付き凍結版の再引継ぎが必要|
|review-s71-kuroda-tomiku1600|正本の承認指紋が空欄。公開可候補ではなく公開可だが、指紋付き凍結版の再引継ぎが必要|

公開審査の調査中15/審査待ち1、地域図鑑の調査中282/審査待ち138/候補保留3を除外。人物紹介は承認JSONとSHAが一致した36人の許可項目だけを投影し、nullを未審査の既存年次・略歴から補完しない。

## 読み込み方式・再現と次版

```sh
node scripts/import-publication-delta.cjs
node scripts/regional-data.cjs apply /path/to/main-catalog.json regional/releases/20261102-line-c.json /path/to/result.json
NODE_PATH=/path/to/node_modules WALKED_BROWSER_ASSETS=/path/to/assets node --test tests/publication-delta.test.cjs tests/regional.test.cjs tests/regional-app.test.cjs tests/publication-import.test.cjs tests/publication-stage2.test.cjs tests/app-integration.test.cjs tests/title-backup.test.cjs
node tests/area-acquisition.test.cjs
```

最終方式はpublication-runtime.jsで既存mainの人物/史跡/カード/関連4ファイルと承認済み差分packageを読み込み、ブラウザ内だけで一括適用する。4ファイルのGit blobはmainと同一で、新旧の未審査行を送信しない。Node importerとブラウザが同じ検証・適用関数を共有し、基準全体SHA・ID順・操作前後・承認package全体SHAを固定。一部適用/同一再適用は不変、競合ID・無関係な基準変更・改変packageは停止。旧stage1/stage2 importerは凍結版専用で、新基準へガードを緩和しない。旧固定件数試験は不変fixtureを明示し、現在runtimeは追加統合試験で別途検証。
--writeは任意の隔離ローカル検証専用。生成全量JSONをPRへ保存する必要はない。差分読込エラー時は旧基準データで起動し、既存の訪問・カード記録を保持して再読み込みを案内する。標準/日本語/絵文字/長文のSHA-256をNode実装と照合、改変と読込失敗時の保存記録維持も検証。
地域図鑑は既存export→diff→applyを利用。記事W=公開可/採用登録、対応J=公開可のAND。公開済みへ移った既存記事がexportに現れなくても削除しない。削除は明示tombstoneのみ。次版も承認データだけ差分化し、反復処理で獲得履歴を増やさない。全対象IDはregional/releases/20261102-line-c.jsonのoperations（items439/relations447）で確定。

## 検証・未確認・引継ぎ

自動74件、地図キー回帰、diff check成功。ID/参照/同一自治体の複数カード/共有記事/未訪問非表示/後追い解放/旧キー/v3復元/再読込/日時と旧カード保持/保存失敗と再試行/30記事段階表示/文章と出典だけの表示を確認。追加更新22カードの史跡全てが実アプリ自治体境界と一致、公開対象判定に合格。
隔離Chromeで合成v3の4地域と旧カード日時1990をUI復元。地域図鑑10項目、町田/八王子共有の大蛇伝説を全国妖怪と東京→町田の両入口から1記事で表示。出典/発信主体/確認日表示、未許諾媒体なし。訪問県の東京/新潟/広島だけselect候補。元就の猿掛1500–1523・郡山1523/1540–1541/1571の4カードと帰属を確認。本番ユーザー保存記録へ書込なし。

iPhone/Safari実機・nativeホイール・タッチ/狭幅・実GPS・現地境界・iOSファイルUI・ホーム画面・オフラインは未確認。ChromeファイルUI成功はiPhone成功を意味しない。
次：Draft PR確認→必要な実機QA→ユーザー承認→mainマージ→Pages/配信JSON/画面確認→実配信IDだけ各研究担当へ公開済み更新を引継ぐ。Cは研究マスターを編集しない。保留11件はA/B担当から照合可能な指紋付き凍結JSONを受領後に別版へ。

最終方式の実Chrome再確認：既存main4配列＋承認パッケージの読み込みで233史跡/250公開対象/72待ち、元就4カード/出典、合成旧記録を確認。自動承認の拒否経緯と最終保存方式はline-c-save-status.md。
