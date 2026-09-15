# SmithNote ブランド移行・公開手順

## GitHub / GitHub Pages

1. GitHubでリポジトリ名を `FitLog` から `SmithNote` へ変更する。
   - ローカルの接続先も `git remote set-url origin git@github.com:ohgiwk/SmithNote.git` で更新する。
2. PagesのSourceがGitHub Actionsになっていることを確認する。
3. Actions Variablesへ `VITE_CANONICAL_URL=https://ohgiwk.github.io/SmithNote/` を登録する。
4. App Store公開後に `VITE_APP_STORE_URL`、問い合わせ先確定後に `VITE_CONTACT_EMAIL` を登録する。
5. `/SmithNote/`、`/SmithNote/app/`、`/SmithNote/#/privacy`、`/SmithNote/#/terms` の表示を確認する。

## App Store / Firebase

1. Apple Developerで `com.keiya.smithnote` のApp IDを新規作成する。
2. App Store ConnectへSmithNoteを新規アプリとして登録し、旧アプリからの移行は設定しない。
3. XcodeでSmithNote用Team、Signing、Provisioning Profileを設定する。
4. FirebaseにSmithNote用iOSアプリを登録し、専用プロジェクトまたは専用Firestore領域を用意する。
5. モバイルビルド環境へSmithNote用Firebase設定を登録する。旧アプリの認証・バックアップデータは引き継がない。

Android版は今回作成しない。着手時は `com.keiya.smithnote` をapplication IDとして新規Capacitor Androidプロジェクトを追加する。
