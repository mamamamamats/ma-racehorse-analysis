# 過去回顧の紐付け：継続手順

ユーザーは2026-11-27に、確認済みの紐付けのDB保存と、未確認馬の継続照合を許可した。DBエラーが出た後は、読み書きを止めて準備だけ続ける。不明な回顧は保留にする。既存の採点式・回顧評価・本文・配列順・予想スナップショットは変更しない。

現在のリポジトリ：`mamamamamats/ma-racehorse-analysis`。作業ディレクトリは `/workspace/work/ma-racehorse-analysis`。このファイルとREADME、最新main、`batches.json`、`backlog-status.json`、`remaining-horses.json` を確認する。別タスクやJSON更新と競合するときは他の変更を保持する。

## まず状態を確認

1. `node scripts/preview-historical-review-backlog.mjs` で保存済みと更新待ちを確認する。件数は固定せず、コマンド出力と最新backlog-status.jsonを正とする。
2. `db-write-pause.json` があり `paused:true` ならDBの読み取り・書き込みをしない。公式資料からの準備だけ行う。エラー後の自動リトライや全件再取得はしない。
3. `.local/historical-review-links/queue.lock` がある場合は進行中の作業を確認し、並行保存しない。中断したロックを確認せず削除しない。

## 馬場の補足情報の修正（2026-11-27 10時回で発見）

出馬表の初期値「良」が古い紐付けの raceRef.trackCondition に入っていたため、公式履歴と成功コミットの保存前バックアップから、私たちが導入した項目だけを修正する。補正2,451件は全件保存・監査済み。going-repair/plan.json は不変の固定計画。元々存在した注記、ユーザーが変更した値、本文・評価・順序・レースIDは変更しない。

- DB停止フラグがなければ、先に `node scripts/apply-review-going-repair.mjs` で残件確認し、待ちがあれば `--apply --limit-horses 1000` を付けて続ける。通常の紐付けと同じqueue.lockを使うため並行保存しない。
- 最初のDBエラーで停止フラグを作る。以後はDBを読み書きせず準備だけ行う。勝手に再開しない。
- 新しい紐付けは公式履歴の馬場を使うよう修正済み。raceRefに元々異なる馬場注記がある場合は上書きせず保留。
- 公開索引は必ず `node scripts/export-verified-review-index.mjs` で生成する。古い不変計画から直接JSONを作るだけでは、修正済み馬場を古い初期値に戻してしまう。
- going-repair/completed.json と、新たなrunディレクトリの変更前データ・コミット応答・結果をgzipに退避してGitへ保存する。`checkpoint-historical-review-progress.mjs` がgzipを自動保存する。未圧縮runは.gitignore対象で保持し、削除や上書きをしない。

## 新しい照合を進める

- `remaining-horses.json` の `unprocessed` から回顧数の多い馬を優先する。公式プロフィールが取得できない馬だけを繰り返さず、新しい馬も進める。`heldHorseRechecks` は別に保留を残す。
- 元マスターは既存の `keiba-data.json.zip` を解凍して再利用する。全馬をDBから読み直さない。新しいZIPを使う場合はハッシュ・exportedAt・元コミットを記録する。過去バッチは上書きしない。
- 公式JRAの対象馬プロフィールと全出走履歴を取得し、生のツール応答を `.local/jra-batch-NNN/sources/*.json` に保存する。`profile-urls.json` で実際に対象馬だと確認した名前と公式URLを対応させる。関連馬の検索結果や勝ち馬欄を対象馬と取り違えない。検索結果で見つかった馬が既存バッチの公式履歴に含まれる場合は、新規取得候補から除く。公式プロフィールのURL別版は明示された公式見出しから対応を確認し、優先URLが変わっただけで別版の断片を捨てたり別URLの行を混ぜたりしない。
- `collect-jra-history-sources.cjs` は行の欠落・同じレイアウト内の矛盾を検出する。見出し〜表末尾が完全でなければ追加取得するか保留。同じ馬名でも初出走の日付・コース等のアンカーに矛盾があれば保留。公式履歴が出馬表より古い場合も保留。
- 同じレース名への複数出走、着順不明、出馬表なし、全体回顧のメタデータ矛盾は無理に紐付けない。回顧が抜けた出走があるため、配列順・消去法・同コースだけで推定しない。馬名のひらがな／カタカナ違いも自動で統合しない。

```sh
node scripts/collect-jra-history-sources.cjs --work-dir .local/jra-batch-NNN
node scripts/plan-historical-review-links.cjs --master /tmp/current-link-master.json --histories .local/jra-batch-NNN/histories.json --out .local/jra-batch-NNN/matching-plan.json
node scripts/prepare-historical-review-batch.cjs --id batch-NNN --matching-plan .local/jra-batch-NNN/matching-plan.json --histories .local/jra-batch-NNN/histories.json
node scripts/run-historical-review-queue.mjs --limit-horses 1000
node scripts/run-historical-review-queue.mjs --apply --limit-horses 1000
```

`NNN` は既存レジストリの次の番号。生応答のgzip、ハッシュを含むsources-manifest、確認したプロフィール一覧、検索した馬と未確定プロフィール一覧も新バッチへ保存する。マッチャーが confirmed でも準備パッケージ化時の追加矛盾チェックで落ちたものは保存しない。

保存スクリプトは馬単位で最新データを1回読み、本文等が一致する唯一の回顧だけ更新する。更新時刻を条件にするため同時編集は上書きしない。成功した分は途中でもcheckpointに残る。最初のエラーで止まり、queue runnerは `db-write-pause.json` を作る。その後は公式照合と固定計画の準備に切り替える。

## 毎回の終了前

- `node scripts/checkpoint-historical-review-progress.mjs` で成功記録と変更前のバックアップをGit管理下へ残す。新バッチの completed.json も次回の再開で利用する。バックアップや固定計画を上書き・削除しない。
- `node scripts/preview-historical-review-backlog.mjs > maintenance/historical-review-links/backlog-status.json`。未確認馬一覧から今回履歴を検証した馬を除き、保留のある馬は再確認一覧へ残す。確定ゼロや未取得の検索結果も記録する。
- 公開照合索引は `node scripts/export-verified-review-index.mjs` で生成し、同じ回顧に別IDがあれば停止する。`verified-review-links.json` の追加は馬券の印や予想スコアの保存し直しを意味しない。
- 関連テスト、差分チェック、Gitへコミット・push、公開索引の反映確認まで行う。準備だけになった場合も公式根拠・保留理由・再開位置を必ずコミットする。
- 日本語で今回の保存件数、累計、保留、未処理、上限エラーの有無を報告する。全頭未完了なのに完了とは言わない。全頭の確認が済めば継続タスクを停止してよい。

ユーザーの2026-11-27の追加指示で、終了は同日16時ごろと確定。継続予約を設定済み（8時から1時間おき、16時まで）。16時以降に開始した最終回は進捗確認・最終報告のみとし、新たな照合やDB操作は始めない。各回は約45分以内で成果を保存し、次回と作業が重複しないようにする。全頭の確認が完了した場合は早期に継続タスクを停止してよい。予約情報は continuation-schedule.json を参照。
