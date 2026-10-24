# WALKED v0.6.3 — 200地点候補版

## 変更点
- `sengoku/sites.json`: 150→200地点。既存150地点は変更なし。
- `sengoku/research-151-200.json`: 追加50地点の個別調査ステータス。
- `.github/workflows/bundle-sengoku-200.yml`: 新規自治体の町丁境界を取得するためのワークフロー。
- `index.html`, `sengoku/cards.json`, `sengoku/people.json`: **変更なし**。

## 重要：今回の50地点は「史跡・寺社の位置データの調査候補」です
- 既存116枚のカードに新規カードは追加していません。新規50地点は史実との人物関連・時代を未検証のため、判定成功時でもカード0枚が正常です。
- これは「200の戦国人物史跡を史料検証できた」ことを意味しません。今回の候補の中には戦国期に関連しない場所も含まれる可能性があります。
- 座標はCODH日本歴史地名大系の代表点です。現地アクセス位置・入り口ではありません。
- 町丁自治体コードは既存自治体区分との対照をもとに付与。実際の町丁ポリゴンとの照合をテストで検証してください。

## GitHubの更新
1. `sengoku/sites.json` を上書き。
2. `sengoku/research-151-200.json` を追加（研究用、アプリ未使用）。
3. `.github/workflows/bundle-sengoku-200.yml` を追加。
4. Actions → Bundle Sengoku 200 town boundaries → Run workflow。
5. WALKEDの設定→歴史カードの動作テストで151〜200を選び、境界取得・区域一致を確認。

## 出典
CODH『日本歴史地名大系』施設・地点項目データセット（CC BY 4.0） https://geoshape.ex.nii.ac.jp/nrct-poi/resource/index.html
