# 営業通知機能 - 実装例（Discord Webhook）

## 実装手順

### 1. Discord Webhook URLの取得

1. Discordサーバーを開く
2. チャンネル設定 → 連携サービス → Webhook
3. 新しいWebhookを作成
4. Webhook URLをコピー（例: `https://discord.com/api/webhooks/1234567890/abcdef...`）

### 2. 環境変数の設定

`.env.local`ファイルを作成（または既存のファイルに追加）:
```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your-webhook-url
```

### 3. API Routeの実装

以下のファイルを作成:
`next-app/src/app/api/notifications/check/route.ts`

---

## 実装コード例

```typescript
import { NextResponse } from 'next/server';
import { loadCustomerRecords } from '@/lib/markdown';
import type { CustomerRecord } from '@/lib/types';

// 日付をパースする関数
function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr === '-') return null;
  
  // 様々な日付形式に対応
  // 例: "2025/11/17", "2025-11-17", "9/30", "11/17"
  const patterns = [
    /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/,  // 2025/11/17
    /^(\d{1,2})[\/\-](\d{1,2})$/,              // 9/30 (今年を仮定)
  ];
  
  for (const pattern of patterns) {
    const match = dateStr.match(pattern);
    if (match) {
      if (match.length === 4) {
        // 完全な日付
        return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
      } else if (match.length === 3) {
        // 月/日のみ（今年を仮定）
        const year = new Date().getFullYear();
        return new Date(year, parseInt(match[1]) - 1, parseInt(match[2]));
      }
    }
  }
  
  return null;
}

// 今日から指定日数以内の日付かチェック
function isWithinDays(date: Date, days: number): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  
  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays >= 0 && diffDays <= days;
}

// 営業アクションが必要な顧客をフィルタリング
function getCustomersToNotify(customers: CustomerRecord[]): CustomerRecord[] {
  const today = new Date();
  const targetCustomers: CustomerRecord[] = [];
  
  for (const customer of customers) {
    // アクションが空または「完了」の場合はスキップ
    if (!customer.nextAction || customer.nextAction === '完了' || customer.nextAction === '-') {
      continue;
    }
    
    // 実行予定日が設定されている場合
    if (customer.scheduledDate && customer.scheduledDate !== '-') {
      const scheduledDate = parseDate(customer.scheduledDate);
      if (scheduledDate && isWithinDays(scheduledDate, 1)) {
        // 今日または明日の予定
        targetCustomers.push(customer);
      }
    } else {
      // 実行予定日が未設定でも、最終連絡日から一定期間経過している場合
      if (customer.lastContactDate && customer.lastContactDate !== '-') {
        const lastContactDate = parseDate(customer.lastContactDate);
        if (lastContactDate) {
          const daysSinceLastContact = Math.floor(
            (today.getTime() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          
          // アクションタイプによって通知タイミングを変える
          if (customer.nextAction === 'リコンタクト' && daysSinceLastContact >= 4) {
            targetCustomers.push(customer);
          } else if (customer.nextAction === 'フォローアップ' && daysSinceLastContact >= 6) {
            targetCustomers.push(customer);
          }
        }
      }
    }
  }
  
  return targetCustomers;
}

// Discordに通知を送信
async function sendDiscordNotification(customers: CustomerRecord[]): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  
  if (!webhookUrl) {
    throw new Error('DISCORD_WEBHOOK_URL環境変数が設定されていません');
  }
  
  if (customers.length === 0) {
    // 通知対象がない場合も送信（オプション）
    return;
  }
  
  // 優先度順にソート
  const priorityOrder: Record<string, number> = {
    'リコンタクト': 1,
    'クロージング': 2,
    'フォローアップ': 3,
    'リマインド': 4,
    '新規提案': 5,
    'リピート提案': 6,
    '取引中': 7,
  };
  
  customers.sort((a, b) => {
    const priorityA = priorityOrder[a.nextAction] || 999;
    const priorityB = priorityOrder[b.nextAction] || 999;
    return priorityA - priorityB;
  });
  
  // メッセージ作成
  let message = '📢 **営業アクション通知**\n\n';
  
  if (customers.length === 0) {
    message += '今日対応すべき顧客はありません。';
  } else {
    message += `今日対応すべき顧客: **${customers.length}件**\n\n`;
    
    customers.forEach((customer, index) => {
      message += `**${index + 1}. ${customer.customerName}**\n`;
      message += `   - アクション: ${customer.nextAction}\n`;
      
      if (customer.scheduledDate && customer.scheduledDate !== '-') {
        message += `   - 実行予定日: ${customer.scheduledDate}\n`;
      }
      
      if (customer.lastContactDate && customer.lastContactDate !== '-') {
        message += `   - 最終連絡日: ${customer.lastContactDate}\n`;
      }
      
      if (customer.contactUrl && customer.contactUrl !== '-') {
        message += `   - 連絡先: ${customer.contactUrl}\n`;
      }
      
      if (customer.totalAmount && customer.totalAmount !== '-') {
        message += `   - 総額: ${customer.totalAmount}\n`;
      }
      
      message += '\n';
    });
  }
  
  // Discord Webhookに送信
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content: message,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Discord通知送信に失敗: ${response.statusText}`);
  }
}

// GET/POSTリクエストを処理
export async function GET(request: Request) {
  try {
    const customers = await loadCustomerRecords();
    const customersToNotify = getCustomersToNotify(customers);
    
    // テストモード（実際には送信しない）
    const searchParams = request.nextUrl.searchParams;
    const testMode = searchParams.get('test') === 'true';
    
    if (testMode) {
      return NextResponse.json({
        ok: true,
        message: 'テストモード',
        customersCount: customersToNotify.length,
        customers: customersToNotify.map(c => ({
          customerName: c.customerName,
          nextAction: c.nextAction,
          scheduledDate: c.scheduledDate,
        })),
      });
    }
    
    // 実際に通知を送信
    await sendDiscordNotification(customersToNotify);
    
    return NextResponse.json({
      ok: true,
      message: `${customersToNotify.length}件の通知を送信しました`,
      customersCount: customersToNotify.length,
    });
  } catch (error) {
    console.error('通知チェックエラー:', error);
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : '通知チェックに失敗しました',
      },
      { status: 500 }
    );
  }
}

// POSTでも同じ処理を実行可能にする
export async function POST(request: Request) {
  return GET(request);
}
```

---

## 4. 定期実行の設定

### 方法A: Vercel Cron Jobs（推奨）

`next-app/vercel.json`を作成（または既存ファイルに追加）:
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

この設定で毎朝9時に自動実行されます。

### 方法B: GitHub Actions

`.github/workflows/notifications.yml`を作成:
```yaml
name: Daily Sales Notifications

on:
  schedule:
    - cron: '0 9 * * *'  # 毎朝9時（UTC）
  workflow_dispatch:  # 手動実行も可能

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - name: Check and notify
        run: |
          curl -X GET "${NOTIFICATION_URL}"
        env:
          NOTIFICATION_URL: https://your-app.vercel.app/api/notifications/check
```

### 方法C: 外部Cronサービス

cron-job.orgなどのサービスで以下のURLを定期実行:
```
https://your-app.vercel.app/api/notifications/check
```

---

## 5. テスト方法

1. ローカルでテスト:
```bash
curl http://localhost:3000/api/notifications/check?test=true
```

2. 実際に通知を送信（テスト）:
```bash
curl -X POST http://localhost:3000/api/notifications/check
```

---

## カスタマイズ例

### 通知頻度を変更
- 毎日: `"0 9 * * *"` (毎朝9時)
- 平日のみ: `"0 9 * * 1-5"` (月〜金の朝9時)
- 複数回: 複数のcronエントリを追加

### 通知内容をカスタマイズ
`sendDiscordNotification`関数内のメッセージフォーマットを変更

### 他の通知方法を追加
Slackやメールの送信処理を追加

