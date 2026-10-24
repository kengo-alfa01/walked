# 戦国時代コレクション — 人物候補マスター

`people.json` は **史跡確認前の候補リスト** です。実在性・同名人物・表記・時代・属性は `verification: needs_review` として未検証扱いです。史跡との関連付けも未開始です。したがって、掲載人数は歴史人物の確定人数ではありません。

- `id` 安定識別子（表示名を変更しても維持）
- `name` 仮の代表表記
- `group` 当面の調査カテゴリ。所属勢力が生涯にわたって一意とは限りません。
- `aliases` 同一人として統合した呼称の候補
- `verification` needs_review / verified / rejected
- `siteResearch` not_started / in_progress / complete
- `source` 人物の基礎情報を確認した個別史料URL。空なら未検証。
- `sites.json`, `cards.json` は史跡の一次資料・文化財台帳等と照合してから投入。

データはゲーム『信長の野望』の収録名簿・画像を複製したものではありません。候補から史料で検証し、誤った人物名・重複を修正します。
