# WALKED v0.6.4 — 境界照合4地点修正・史実カード精査 第1弾

- 既存200地点維持
- テスト地点100・120・146・150の座標／自治体コード照合を修正
- 裏付けのある歴史カード2枚を追加（合計118枚）
- 新しい歴史内容は未獲得の間、WALKED上では非公開
- 本番の獲得履歴や制覇記録は削除不要

## GitHub更新
1. `sengoku/sites.json` 上書き
2. `sengoku/cards.json` 上書き
3. `.github/workflows/bundle-sengoku-fixes.yml` 追加
4. （任意）`sengoku/audit-v0.6.4.json` 追加（開発用）
5. Actions > Bundle Sengoku boundary fixes > Run workflow
6. 設定 > テスト地点 100 / 120 / 146 / 150 を再判定

`index.html` は更新不要。境界照合が成功してもカード0枚なら史料未検証地点として正常な場合があります。

## 注意
- 修正4地点のうち146は「里宮」を代表地点として採用。旧本宮（二合目）の位置と混同しない。
- 2026-10-25時点の公開資料で所在地・由緒を再確認したが、GitHub Actions実行・実機検証は未実施。
- 人物との関係が未確認の既存カードは別途精査が必要。
