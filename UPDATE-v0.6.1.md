# WALKED v0.6.1 — 登録史跡61〜100地点

## 更新するファイル
- `sengoku/sites.json`（60→100地点）
- `sengoku/cards.json`（74→114カード）
- `.github/workflows/bundle-sengoku-100.yml`（新規）

`index.html` は更新不要。既存データ・履歴の削除も不要。

## 反映
1. JSON 2ファイルをGitHubの `sengoku/` に上書きアップロード。
2. ワークフローを `.github/workflows/` にアップロード。
3. Actions → Bundle Sengoku 100 town boundaries → Run workflow。
4. 成功後にWALKEDを再読み込み、設定の歴史カード動作テストで61〜100を試す。

## 重要：史実の扱い
今回40地点は『日本歴史地名大系』施設・地点項目データ（CODH）記載の代表点を使用。今回の**40地点すべてが、場所の存在と代表点を確認した段階の `review_needed`** です。後者は人物リンクが暫定的であり、正式な歴史叙述として公開する前に要再検証です。既存のWALKEDの獲得機構は `review_needed` も判定対象に含みます。ここでのテスト成功は史実の確認ではありません。

所在地・町丁境界の照合も実際のGitHub ActionsとiPhoneでの動作検証が必要です。

位置座標出典：国立情報学研究所CODH『日本歴史地名大系』施設・地点項目（CC BY 4.0）。
