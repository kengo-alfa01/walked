# WALKED 戦国データ仕様 (v1)

実データは史跡の場所・人物との関連性・出典を検証してから投入します。配布版の JSON は空配列から開始します。

- `people.json`: `[ { "id": "p-001", "name": "人物名", "group": "所属・勢力", "source": "https://..." } ]`
- `sites.json`: `[ { "id": "site-001", "name": "史跡名", "point": [139.0, 35.0], "municipalityCode": "13209", "evidence": "本人との関係の説明", "source": "https://...", "evidenceType": "direct" } ]`
- `cards.json`: `[ { "id": "card-001", "personId": "p-001", "siteId": "site-001", "title": "発見後に読む題名", "summary": "独自の解説文", "source": "https://..." } ]`

IDは公開後に変更しないこと。緯度経度は `[経度, 緯度]`。地理学的に代表点が属する町丁・字全域が獲得範囲。
`evidenceType` は `direct`（直接の史実）/`later`（後世の顕彰）/`tradition`（伝承）とする。
Googleタイムラインの点と史跡代表点が同じ境界ポリゴンにある場合だけ獲得。記録点間を直線補間しない。
全国の町丁データ取得と獲得判定の完全連携は現段階では未完成。町田・相模原以外の読込済み境界についてのみ部分対応。
