# 日本見風録：人物・地域図鑑UI改善（2026-11-05）

## 対象（今回の6件）
1. 公開済みの収集対象経歴を全件解放した人物について、承認済みの略歴を表示。長文（目安1000字）未承認なら既存の承認済み短文を使用し、推測で増量しない。
2. 地図の市区町村・町丁目をタップしたとき、閲覧モードではその自治体の獲得済み地域図鑑を直接開く。未訪問なら内容は出さない。エリア追加モードON時は従来どおり登録・解除。都道府県境界単体は対象外。
3. 解放済み史跡経歴の年代横に、公開済み史跡の市区町村名を表示。未発見カードの所在地は開示しない。
4. 獲得人物を選択すると、その人物に紐づく**解放済み**史跡ピンに地図を絞る。人物画面を閉じたとき、または「全人物の史跡ピンを表示」で戻す。
5. 史跡ピンの半径を7→5ピクセルへ変更し、濃色の縁と高コントラスト塗りで視認性を保つ。
6. 人物獲得済みなら、場所に依存しない**公開承認済み**の経歴を年表中に表示する。未獲得なら表示しない。

**今回は「地域図鑑と戦国のモード切替」を含めない**。別案として保留する。

## 場所に依存しない経歴・人物略歴の公開データ

`sengoku/non-place-history.json` を追加。

```json
{
  "schemaVersion": "walked.sengoku.non-place.v1",
  "version": "release-version",
  "entries": [
    {
      "id": "approved-history-record-id",
      "personId": "existing-person-id",
      "title": "承認済みの出来事名",
      "summary": "出典に基づく独自文",
      "eventYear": 1550,
      "eventYearEnd": null,
      "placeRelation": "none",
      "publicationStatus": "公開可",
      "approvalId": "confirmed-release-approval-id",
      "sourceUrls": ["https://example.org/source"]
    }
  ],
  "biographies": [
    {
      "personId": "existing-person-id",
      "summary": "承認済みの長文略歴。1000字は目安であり、証拠に応じて短くする。",
      "attribution": "原出典と編集情報",
      "sourceUrls": ["https://example.org/source"],
      "publicationStatus": "公開可",
      "approvalId": "confirmed-release-approval-id"
    }
  ]
}
```

初版は `entries=[]` / `biographies=[]`。データ自体はAの本文判定だけで自動配信せず、Cの公開審査・元ID・本人の同一性・参照URL・利用条件を別途確認した承認済みレコードのみ追加する。位置不明の出来事へ仮の史跡IDや座標を創作しない。既存の `sengoku/approved-profiles.json` の短い紹介文は保持する。

## 確認と制約

- `index.html`、`regional-ui.js`、追加テストの構文検査済み
- 追加テスト：`tests/regional.test.cjs`、`tests/map-search.test.cjs`
- 実機・全自動テストの実行は別途必要。実行結果がないものを合格とみなさない
- 訪問記録 `walked_municipal_v2`、人物カード `walked_sengoku_cards_v1`、称号 `walked_titles_v1` の保存形式とバックアップ形式は変えない
- 本番公開は作業PRのレビュー後、ユーザー承認を受けて行う
