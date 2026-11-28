# ホーム画面版の更新

ユーザーモードは起動時の公開JSON/ZIP読み込みに加え、pageshow.persisted、バックグラウンドからのvisibility復帰、オンライン復帰で更新を確認する。30秒以内の重複確認を抑止し、処理中は重複実行しない。読み込んだ公開ファイルのETag（なければLast-Modified）をHEADで比較し、変わったときだけ本体を取得する。手動の「最新データを読み込む」はこの間隔・ETagを無視して再取得する。

画面を更新する場合は public-release.json の shellVersion と public-refresh.js の VERSION、index.html の public-refresh.js クエリを同時に変更する。古い画面は小さな公開リリースJSONで新版を知り、現在のクエリとハッシュを残して _app を新バージョンに置き換える。同じ _app でも古いJSが返る場合は無限リロードせず停止する。

データ取得はキャッシュ回避クエリ・no-store付き。ZIP展開のJSZipはvendorへ同梱し、initAppより前に読み込む。外部CDNの通信失敗や読み込み順に依存しない。取得失敗時はローカル保存データを保持し、更新失敗を表示する。端末ストレージを消去する操作は設けない。

公開更新はFirebaseやDataArchiveの強制再取得を呼ばない。IndexedDB更新後はメモリ上の馬・開催と選択馬を読み直し、表示中の一覧・詳細・既に材料取得済みの予想を再表示する。編集モードでは更新ボタン・復帰時の更新を追加しない。予想スナップショットとユーザーの後発編集は変更しない。

iOSに以前のHTMLそのものが保存され、新しい更新処理がまだ届かない場合、この処理だけで古い画面を更新させることはできない。初回だけ `_app=20261128-refresh1` 付きURLから追加し直す案内を使う。追加し直しに伴って旧ホーム画面版のローカルデータを消す案内はしない。

検証：node --test tests/*.test.mjs、node tests/browser/public-refresh.cjs。後者はモバイルサイズのChromiumでBFCache復帰イベント・visibility復帰・更新なしのHEAD・オフライン保持と手動復旧・画面バージョン変更・外部CDNなしのZIP展開・編集モード除外を確認する。iPhone実機の検証ではない。
