# 日本見風録 — 戦国時系列 v1 / C受入手順（2026-11-10）

## 1. 現在の公開状態と保護対象

- 現行公開の先行3人108経歴は旧方式を維持する。A/B審査中の②Tはまだ公開データではない。
- sengoku/v2/chronology-release.json は releases: []（正式順位0件）。
- ②T値からCが「B合格」や「ユーザー公開OK」を代理判定しない。
- 既存の⑥行、F/G、承認履歴、経歴ID、本文、史跡座標、カード獲得条件、保存キー、バックアップ形式、地域図鑑、称号には変更を加えない。
- 本番公開は別工程。ユーザーから別途指示があるまでmainを更新しない。

| ソース | 用途 | この工程での操作 |
| --- | --- | --- |
| sengoku/v2/approved-three-person-staging.json | 旧承認済み108件・61史跡・46ピン | 編集禁止 |
| sengoku-v2-core.js | ID/獲得/解放/史跡 | 編集不要 |
| sengoku-chronology.js | 順位、同順位、A/B制約、⑥Q検証 | 新規 |
| sengoku/v2/chronology-release.json | 人物単位の正式順位パッケージ | 審査完了まで空配列 |
| index.html | 表示切替と同順位注記 | 表示のみ |
| scripts/check-sengoku-chronology.cjs | ローカル書込なし受入チェック | C取込前に使用 |

## 2. ②経歴のJSON行

対象人物の全経歴について必須。途中の1件でも欠けた人物は、新順位に切り替えない。

- historyId=②K。人物ごとの元経歴IDを変えない。
- personId=②L。元人物IDを変えない。
- startYear=②I。正整数。年次テキストから再推定しない。
- endYear=②J。単年はnull。長期活動は開始年で並べ、②Bの期間文字列を維持する。
- yearText=②B。
- phase=②F。「死去」「没後」はこの構造化区分を参照する。墓、菩提寺、死去などの本文キーワードから推定しない。
- displayOrder=②T。同一年複数件は全件正整数（10,20,20,30等）。単年1件はnull可。
- tieStatus=同年同Tが複数の場合はunresolved、それ以外はnull。
- tieReason=同年同Tの各行に②Sの未確定理由。単独はnull。
- tieEvidenceIds=同年同Tの各行に⑤出典ID配列。単独は[]。

同TはID重複ではない。ただし同値グループの②S理由・⑤出典がない場合は取込不可。
同順位内の元配列順は画面安定化にだけ用い、史実上の前後を意味しない。
新方式の年・ID・年次表示は旧公開JSONのeventYear, eventYearEnd, yearTextと一致すること。年そのものの変更が必要な場合は別工程で本文・年次・B審査・⑥承認を改版する。

## 3. Bの前後制約・審査証跡

Cが受け取る制約の必須キーは beforeId, afterId, type, bVerified, evidenceIds。
type は confirmed-date / confirmed-causality / life-before-death / death-before-funeral / death-before-burial / death-before-reburial / posthumous-sequence のいずれか。
confirmed-dateはcalendarBasis（旧暦・新暦・改元の照合記録）が必要。
bVerified=true、⑤出典ID1件以上の制約のみ採用する。

出陣→合戦→戦後処理、本人の生前活動→本人死去→葬儀→埋葬→改葬、確定した日付順を構造化して検証する。
別年のT同士は比較しない。長期活動の終了年によって開始順を勝手に変更しない。B未確認の制約をCが作らない。

bReviewの必須キー：
- status=合格
- reviewedBy=B
- reviewId=Bの審査識別子
- coveredHistoryIds=人物の全経歴ID
- rowsSha256=全行の年・順位・同順位理由・出典を含む正規化JSONのSHA-256
- constraintsSha256=Bが確認した制約の正規化JSONのSHA-256

SengokuChronology.validateRows(rows,constraints,sha256) で正規化ハッシュを算出してB証跡に固定する。
B合格後にT・未確定理由・制約が変わった場合は再審査する。

## 4. ⑥Qに固定する順序承認スナップショット

⑥は新しい版を別行に提出し、ユーザーが⑥F=公開OKを直接判定する。⑥P=一致は本文照合であり順位承認とは無関係。
⑥Qには、最低限、以下を機械可読で固定する。

- schemaVersion = walked.sengoku.chronology.snapshot.v1
- personId, historyId, startYear, endYear, displayOrder, tieStatus
- yearGroupSha256（同一人物・同年全件の正規化ハッシュ）
- bReviewId, bRowsSha256, bConstraintsSha256

SengokuChronology.snapshotFor(row,verifiedRows,bReview) で生成可能。
⑥Qの既存経過メモと混同しないよう「【時系列Qスナップショットv1】」の下に独立した機械可読JSONとして格納し、Cは元のQセルを再読取・パース・全項目一致照合する。

Cの受入ゲートは⑥最新版のF=公開OK、P=一致、J=C候補（別途公開承認）、L/M元ID一致、O版が旧承認より新しい、旧承認とは別の⑥行、本文ハッシュ一致、B合格、Qスナップショット一致、人物の全経歴で最新承認が揃っていること。

マニフェスト中のlatest=trueは、Cが⑥の全版を読んで算出した場合だけ正当。提出資料の自己申告で真にしない。旧⑥行やF/G、既存承認の書換・流用は禁止。

## 5. C受入と公開前QA

1. 最新②I/J/K/L/B/F/S/T、⑤出典ID、Bの順序制約・審査証跡を読み取る。
2. ⑥の人物・元ID・最新版・F/J/O/P/Qと承認した本文を読み、Qの順位を現行②と突合する。
3. 人物全件が揃ったときだけreleases[]へセットして、一時JSONを作業ブランチ内に置く。
4. node scripts/check-sengoku-chronology.cjs path/to/candidate.json で検証。テスト用release.testFixture=trueは本番ゲートで拒否する。
5. 不整合なら空のマニフェストのまま旧表示継続。合格なら作業ブランチでプレビューしてiPhone相当WebKit/PC Chromiumと回帰テストを実施する。
6. ユーザーに受入QAを報告し、明示的な本番公開指示が出るまでmainは変えない。

現時点の既定マニフェストはreleases:[]で、チェックがWAITING（公開済み順位0件）を示すのが正しい。

## 6. 表示と復旧

新順位がB/⑥とも承認済みの人物だけ、開始年→同年Tの昇順に表示する。
同Tの経歴群には各群1箇所に「同年の出来事。前後関係は確定していません。」と表示。同時発生を意味しない。
マニフェストの欠損・読込遅延・B/⑥不一致なら、まず既存108件を表示し、旧年→ID順の表示を維持する。取得・訪問・保存は独立したまま。

テスト対象はT欠落/不正、同値、異年T再利用、月日/旧暦とB制約、因果、本人の死去と没後、Q改変、B審査時順位改変、旧承認の混入、既存108件・バックアップ/復元・称号・地域図鑑・46公開ピン、iPhone/PCの表示。

復旧：本番のmainは現時点で未変更。将来公開後に不具合があれば、時系列マニフェストをreleases:[]に戻して旧表示に戻し、必要なら公開差分コミットをgit revertする。既存カード保存/訪問/経歴IDは削除しない。

## 制限事項

ブラウザは⑥QやB結果をGoogle Sheetsから直接認証するわけではない。C取込者が実際の正本②・⑥・B証跡に照合したうえで、合格したマニフェストだけをコミットすること。Qが機械可読でない、根拠に欠落がある、年次や本文が旧版から変わっている場合は、そのまま新順位を公開しない。
