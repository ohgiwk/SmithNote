# Firebase クラウドバックアップ

作成日: 2026-07-03

SmithNote は端末内の `localStorage` を正本にし、希望するユーザーだけ Firebase Authentication と Cloud Firestore を使って手動クラウドバックアップ/復元を利用する。

## 役割

- 未ログインでもアプリ本体は通常どおり使える。
- 初回起動時に認証画面を表示するが、「あとで」を選べば未ログインのまま利用できる。
- メールアドレス・パスワードまたはGoogleアカウントでログインできる。
- 新規登録時は Firebase Auth の確認メールを送信する。
- 確認メールとパスワード再設定メールは Firebase 標準のメールアクション画面を使い、Capacitor のカスタムスキームを継続 URL として渡さない。
- クラウドには `State` 全体のスナップショットを保存する。
- 復元時は取得した `State` を `normalizeState` に通し、成功した場合だけローカル状態を置き換える。
- アカウント削除時は、ユーザー配下の Firestore データを削除してから Firebase Auth ユーザーを削除する。

## 必要な環境変数

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_STORAGE_BUCKET` 任意
- `VITE_FIREBASE_MESSAGING_SENDER_ID` 任意
- `VITE_GOOGLE_WEB_CLIENT_ID`（iOSのGoogleログインで使用）

必須の 4 項目が揃っていない場合、クラウドバックアップだけ無効になる。ローカル保存と JSON エクスポート/インポートは引き続き利用できる。

## Firestore 構成

```text
users/{uid}
  email
  updatedAt
  devices/{deviceId}
    name
    platform
    lastSeenAt
    backupUpdatedAt
    stateJson
    stateSchemaVersion
  backups/{backupId}
    deviceId
    stateJson
    stateSchemaVersion
    createdAt
```

現在の自動バックアップは `backups/current` にアカウント単位で1件保存する。`devices/{deviceId}.stateJson` とランダムIDの `backups/{backupId}` は旧形式として読み取り互換性を維持する。

`firestore.rules` は `users/{uid}` 配下をログイン中の同一ユーザーだけ読み書きできるように制限する。Rules を更新する場合は Firebase CLI で `firebase deploy --only firestore:rules --project <project-id>` を実行する。

## 実装ポイント

- Firebase 初期化は `src/firebaseClient.ts` に閉じている。
- iOS の Capacitor WebView では認証状態を `localStorage` に保存する `browserLocalPersistence` を明示し、IndexedDB の初期化待ちでログインが停止しないようにする。Web では Firebase の既定永続化を使う。
- iOS の Firestore 通信は long-polling を強制し、WKWebView と WebChannel の互換性問題でバックアップ通信が失敗しないようにする。Web では自動判定を使う。
- Firestore は `State` 全体の保存に備えて `ignoreUndefinedProperties` を有効にする。
- クラウド操作は `src/cloudBackup.ts` にまとめ、画面側は `useBackup` 経由で呼び出す。
- ログイン後に復元方針が確定すると、変更から3秒後にアカウント共通の `backups/current` を上書きする。通信失敗時はオンライン復帰後に再試行する。
- 旧 `devices/{deviceId}` は削除せず、移行用の復元候補として引き続き読み取る。
- ログイン時に既存データがあれば、クラウド復元または端末優先を選択するまで自動保存を開始しない。
- 旧 `backups/{backupId}` は削除せず、復元候補として引き続き読み取る。
- `deleteCloudAccount` は Firestore の `users/{uid}` 配下を削除してから Firebase Auth のユーザーを削除する。
- Firebase Auth の仕様上、パスワード変更やアカウント削除は最近ログインしていないと失敗することがある。その場合は再ログインしてから操作する。

## GitHub Pages

`.github/workflows/deploy-pages.yml` の Build step で Firebase 用の `VITE_` 環境変数を渡す。Repository secrets に必須4項目と同名の値を設定する。設定変更後はワークフローを再実行してビルドし直す。

Firebase Authenticationでは利用する認証プロバイダーを有効にし、承認済みドメインに `ohgiwk.github.io`（パスなし）を追加する。設定値はFirebaseのWebアプリ用を使用する。

## GoogleログインのiOS設定

- Firebase AuthenticationでGoogleプロバイダーを有効にする。
- XcodeのUser-Defined Settingsに `GOOGLE_IOS_CLIENT_ID` と `GOOGLE_IOS_REVERSED_CLIENT_ID` を設定する。`Info.plist` の `GIDClientID` とURL Schemeから参照される。
- Web OAuthクライアントIDを `VITE_GOOGLE_WEB_CLIENT_ID` に設定する。
