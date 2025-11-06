# Discord Webhook 営業通知機能 - 詳細実装ガイド

## ステップ1: Discord Webhook URLの取得（最も重要）

### 1-1. Discordサーバーを開く
1. DiscordアプリまたはブラウザでDiscordにログイン
2. 通知を送信したいサーバーを選択
   - 既存のサーバーを使うか、新しいサーバーを作成

### 1-2. チャンネル設定を開く
1. 通知を送信したいチャンネルを選択（例: #営業通知）
2. チャンネル名の横にある**⚙️（歯車アイコン）**をクリック
   - またはチャンネル名を右クリック → **編集**を選択

### 1-3. Webhook設定画面を開く
1. チャンネル設定画面の左メニューから**「連携サービス」**をクリック
2. **「Webhook」**セクションを確認
3. **「新しいWebhook」**ボタンをクリック

### 1-4. Webhookを作成
1. **名前**を設定（例: "営業通知Bot"）
2. **アイコン**を設定（任意）
3. **「Webhook URLをコピー」**ボタンをクリック
   - URLの形式: `https://discord.com/api/webhooks/1234567890123456789/abcdefghijklmnopqrstuvwxyz1234567890`
4. **「保存」**ボタンをクリック

### 1-5. Webhook URLを安全に保管
⚠️ **重要**: このURLは秘密情報です。他の人に共有しないでください。

---

## ステップ2: 環境変数の設定

### 2-1. `.env.local`ファイルを作成
プロジェクトのルート（`next-app`フォルダ内）に`.env.local`ファイルを作成：

```bash
# next-appフォルダに移動
cd next-app

# .env.localファイルを作成（エディタで作成してもOK）
touch .env.local
```

### 2-2. Webhook URLを環境変数に設定
`.env.local`ファイルに以下を記述：

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/あなたのWebhookURLをここに貼り付け
```

**例:**
```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/1234567890123456789/abcdefghijklmnopqrstuvwxyz1234567890
```

### 2-3. Vercelにデプロイする場合の環境変数設定
Vercelにデプロイする場合は、Vercelのダッシュボードで環境変数を設定：

1. Vercelダッシュボードにログイン
2. プロジェクトを選択
3. **Settings** → **Environment Variables**を開く
4. 以下の環境変数を追加：
   - **Name**: `DISCORD_WEBHOOK_URL`
   - **Value**: Discord Webhook URL
   - **Environment**: Production, Preview, Development（すべてにチェック）

---

## ステップ3: API Routeの作成

### 3-1. ファイル作成
以下のパスにファイルを作成：
`next-app/src/app/api/notifications/check/route.ts`

### 3-2. 実装コード
（次のファイルで実装します）

---

## ステップ4: Vercel Cronの設定

### 4-1. `vercel.json`ファイルを作成
プロジェクトのルート（`next-app`フォルダ内）に`vercel.json`ファイルを作成：

```json
{
  "crons": [
    {
      "path": "/api/notifications/check",
      "schedule": "0 9 * * *"
    }
  ]
}
```

### 4-2. Cronスケジュールの説明
- `"0 9 * * *"` = 毎日午前9時（UTC）
- 日本時間（JST）はUTC+9なので、UTC 9時 = JST 18時（午後6時）

#### よく使うスケジュール例：
- `"0 9 * * *"` - 毎日9時（UTC）
- `"0 0 * * *"` - 毎日0時（UTC）= 日本時間9時
- `"0 9 * * 1-5"` - 平日（月〜金）の9時（UTC）
- `"0 0 * * 1"` - 毎週月曜日の0時（UTC）

### 4-3. Vercelにデプロイ
```bash
# Vercel CLIを使用する場合
vercel

# またはGitHubにプッシュすると自動デプロイ
git add .
git commit -m "Add notification feature"
git push
```

### 4-4. Vercel Cronの確認
1. Vercelダッシュボードを開く
2. プロジェクトを選択
3. **Settings** → **Cron Jobs**を開く
4. Cronジョブが登録されているか確認

---

## ステップ5: テスト方法

### 5-1. ローカルでテスト（通知を送信しない）
```bash
# テストモード（通知を送信せず、結果のみ表示）
curl http://localhost:3000/api/notifications/check?test=true
```

開発サーバーを起動していない場合は：
```bash
cd next-app
npm run dev
```

### 5-2. 実際にDiscordに通知を送信（テスト）
```bash
# 実際にDiscordに通知を送信
curl -X POST http://localhost:3000/api/notifications/check
```

### 5-3. ブラウザでテスト
ブラウザで以下のURLを開く：
```
http://localhost:3000/api/notifications/check?test=true
```

### 5-4. デプロイ後のテスト
Vercelにデプロイ後、以下のURLでテスト：
```
https://your-app.vercel.app/api/notifications/check?test=true
```

---

## トラブルシューティング

### 問題1: Webhook URLが見つからない
**解決策**: 
- チャンネル設定 → 連携サービス → Webhookを確認
- サーバー管理者権限が必要な場合があります

### 問題2: 環境変数が読み込まれない
**解決策**:
- `.env.local`ファイルが`next-app`フォルダ内にあるか確認
- 開発サーバーを再起動（`npm run dev`を停止して再実行）
- Vercelの環境変数設定を確認

### 問題3: Cronが実行されない
**解決策**:
- `vercel.json`のパスが正しいか確認
- VercelダッシュボードのCron Jobsで確認
- 初回実行まで少し時間がかかる場合があります

### 問題4: 通知が来ない
**解決策**:
- Webhook URLが正しいか確認
- 今日対応すべき顧客がいるか確認（`?test=true`で確認）
- サーバーログを確認

---

## 補足: Discord Webhookの使い方

### Webhook URLの形式
```
https://discord.com/api/webhooks/{WEBHOOK_ID}/{WEBHOOK_TOKEN}
```

### メッセージのカスタマイズ
Discord Webhookは以下の形式でメッセージを送信できます：

```json
{
  "content": "テキストメッセージ",
  "username": "カスタムユーザー名",
  "avatar_url": "https://example.com/avatar.png",
  "embeds": [
    {
      "title": "タイトル",
      "description": "説明",
      "color": 3447003
    }
  ]
}
```

更に詳細なカスタマイズが必要な場合は、Discord APIドキュメントを参照してください。

