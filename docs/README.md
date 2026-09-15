# SmithNote ドキュメント

SmithNote の仕様・設計ドキュメントの入口です。

## SmithNote とは

- React + Vite + TypeScript で作られた筋トレ記録モバイルアプリです。
- アプリ本体は Capacitor で iOS 向けにビルドし、GitHub Pagesでも公開します。
- 通常の記録データは端末の `localStorage` に保存され、未ログインでもローカル完結で使えます。
- Firebase設定がある環境では、希望するユーザーだけメールアドレス・パスワードでログインし、手動クラウドバックアップ/復元を利用できます。
- モバイル優先で、起動直後から選択日のトレーニングを記録できます。
- GitHub Pagesではランディングページ、プライバシーポリシー、利用規約を `/FitLog/` で公開します。`main` への push でデプロイが自動実行されます。

## ドキュメント一覧

| ドキュメント | 内容 |
| --- | --- |
| [`specification.md`](./specification.md) | 実装に基づく詳細仕様（型・永続化・画面・ロジック・機能） |
| [`test-specification.md`](./test-specification.md) | 自動テストの対象・観点・未カバー範囲 |
| [`firebase-backup.md`](./firebase-backup.md) | Firebase クラウドバックアップの構成・運用メモ |
| [`store-release.md`](./store-release.md) | iOS App Store / Google Play 公開に向けた準備メモ |
| [`brand-migration.md`](./brand-migration.md) | リポジトリ、App Store、Firebaseのブランド移行手順 |
| [`improvements.md`](./improvements.md) | 今後の改善候補（備忘録） |

> リポジトリ運用ルール（コミット方針・コーディング方針など）は、ルートの [`AGENTS.md`](../AGENTS.md) を参照してください。

## 主な機能

- 日付ごとのトレーニング記録（種目・セット・重量・回数/秒数・強度・メモ）
- 種目マスタの管理（部位別グループ、追加・削除・並び替え、回数/秒数の切り替え）
- プリセットによる種目の一括投入
- プリセットごとの計画（曜日指定 / 何日ごと）
- 種目別の履歴とベスト記録（MAX 1RM・最大重量・最大負荷量など）
- 種目ごとの重量・回数目標と、達成時の次目標設定
- 種目ごとの目標達成日・達成重量・回数の履歴
- 1RM 推定・合計レップ/秒/負荷量の集計
- 重量単位（kg / Lbs）の切り替え
- レストタイマー（音アラート付き）
- データの JSON エクスポート / インポート
- 壊れた保存データの退避、描画エラー時の復旧画面

## 画面構成

| 画面 | 役割 |
| --- | --- |
| ホーム | 選択日の一覧・集計・プリセット開始・カレンダー |
| 種目選択 | 部位別の種目一覧・並び替え・削除 |
| 種目追加 / 編集 | 種目の基本情報・握りの向き・握り方の設定 |
| 種目詳細 | セット入力・1RM・強度・グリップ・レストタイマー |
| 種目別履歴 | ベスト記録と日別のセット履歴 |
| 目標達成記録 | 種目ごとの達成日・重量・回数/秒数 |
| トレーニングメニュー | メニューの一覧・追加・編集・削除 |
| プリセット編集 | トレーニングメニュー画面から作成・編集するプリセットとスケジュール |
| プリセット種目選択 | 部位・器具カテゴリ別の一覧から複数種目を選択 |
| 分析 | 記録済みワークアウトの種目別・部位別実施回数 |
| 設定 | 重量単位などのアプリ設定 |
| 通知設定 | トレーニング未記録時のローカル通知設定 |

ホームを起点とし、トレーニングメニュー・目標達成記録・分析・設定はホームのドロワメニューから表示します。

## アーキテクチャ概略

```
useSmithNoteCore (state + 永続化 + トースト)
   ├─ useNavigation / useSmithNoteUi / useSmithNoteSelectors
   └─ usePresetActions / useWorkoutActions / useExerciseActions
      / usePartActions / useBackup
            │
        useSmithNote (統合)
            │
      SmithNoteContext (配布)
            │
   各画面の useXScreenModel (view-model)
```

詳細は [`specification.md`](./specification.md) を参照してください。

## 開発コマンド

```bash
npm run dev          # 開発サーバー
npm run dev:app      # モバイルアプリ本体の開発サーバー
npm run build        # ランディングページとアプリ本体の生成
npm run build:ios    # Capacitor/iOS 向けの Web アセット生成
npm run cap:sync:ios # build:ios 後に iOS プロジェクトへ同期
npm run cap:open:ios # Xcode で ios プロジェクトを開く
npm run preview      # ビルド成果物のプレビュー
npm test             # vitest run
npm run test:watch   # vitest watch
npm run test:e2e     # Playwright E2E
npm run test:e2e:ui  # Playwright UI モード
```

## iOS アプリ化

Capacitor の iOS プロジェクトは `ios/` 配下にあります。

```bash
npm run cap:sync:ios
npm run cap:open:ios
```

`npm run build` は GitHub Pages 用に `/FitLog/` をbaseとするランディングページとアプリ本体を生成します。iOSへ同期する場合は `npm run cap:sync:ios` を使い、モバイルアプリ本体を相対パスで生成してCapacitorへ同期します。

GitHub Pagesのトップ `/FitLog/` はランディングページ、`/FitLog/app/` はアプリ本体です。「アプリを使う」から記録画面を開けます。両方を1回のビルド・デプロイで更新します。
