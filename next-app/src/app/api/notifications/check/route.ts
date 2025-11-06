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

// 実行予定日を計算する関数（CustomerManager.tsxと同じロジック）
function calculateScheduledDate(customer: CustomerRecord): Date | null {
  const { nextAction, lastContactDate } = customer;
  
  // アクションが設定されていない場合はnullを返す
  if (!nextAction || nextAction === '未設定' || nextAction === '') {
    return null;
  }

  // 最終連絡日が設定されていない場合はnullを返す
  const lastDate = parseDate(lastContactDate);
  if (!lastDate) {
    return null;
  }

  const now = new Date();
  let daysToAdd = 0;

  // アクション種類に応じて日数を計算（CustomerManager.tsxと同じ）
  if (nextAction.includes('リコンタクト')) {
    daysToAdd = 5; // 5日以内実行
  } else if (nextAction.includes('フォローアップ')) {
    daysToAdd = 9; // 7-10日間隔（平均8.5日、四捨五入で9日）
  } else if (nextAction.includes('新規提案')) {
    daysToAdd = 14; // 2週間後を目安
  } else if (nextAction.includes('リマインド')) {
    daysToAdd = 14; // 2週間後を目安
  } else if (nextAction.includes('クロージング')) {
    daysToAdd = 7; // 1週間後を目安
  } else if (nextAction.includes('完了')) {
    return null; // 完了の場合は実行予定日なし
  } else {
    // その他のアクションは14日後をデフォルト
    daysToAdd = 14;
  }

  // 最終連絡日から指定日数後を計算
  const scheduledDate = new Date(lastDate);
  scheduledDate.setDate(scheduledDate.getDate() + daysToAdd);

  // 今日より過去の日付の場合は今日から計算
  if (scheduledDate < now) {
    const newScheduledDate = new Date(now);
    newScheduledDate.setDate(newScheduledDate.getDate() + daysToAdd);
    scheduledDate.setTime(newScheduledDate.getTime());
  }

  return scheduledDate;
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
    
    let scheduledDate: Date | null = null;
    
    // 実行予定日が設定されている場合はそれを優先
    if (customer.scheduledDate && customer.scheduledDate !== '-') {
      scheduledDate = parseDate(customer.scheduledDate);
    }
    
    // 実行予定日が未設定の場合は、最終連絡日から計算
    if (!scheduledDate && customer.lastContactDate && customer.lastContactDate !== '-') {
      scheduledDate = calculateScheduledDate(customer);
    }
    
    // 実行予定日が確定し、今日または明日の場合は通知対象
    if (scheduledDate && isWithinDays(scheduledDate, 1)) {
      targetCustomers.push(customer);
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
    // 通知対象がない場合は送信しない（必要に応じて変更可能）
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
      
      // 実行予定日の表示（設定されている場合はそれを、未設定の場合は計算）
      let displayScheduledDate: string | null = null;
      if (customer.scheduledDate && customer.scheduledDate !== '-') {
        displayScheduledDate = customer.scheduledDate;
      } else {
        const calculatedDate = calculateScheduledDate(customer);
        if (calculatedDate) {
          const year = calculatedDate.getFullYear();
          const month = String(calculatedDate.getMonth() + 1).padStart(2, '0');
          const day = String(calculatedDate.getDate()).padStart(2, '0');
          displayScheduledDate = `${year}/${month}/${day}`;
        }
      }
      
      if (displayScheduledDate) {
        message += `   - 実行予定日: ${displayScheduledDate}`;
        if (!customer.scheduledDate || customer.scheduledDate === '-') {
          message += ' (計算値)';
        }
        message += '\n';
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
      username: '営業通知Bot', // カスタムユーザー名（オプション）
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Discord通知送信に失敗: ${response.statusText} - ${errorText}`);
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
        customers: customersToNotify.map(c => {
          // 実行予定日の計算（設定されている場合はそれを、未設定の場合は計算）
          let scheduledDateDisplay: string | null = null;
          if (c.scheduledDate && c.scheduledDate !== '-') {
            scheduledDateDisplay = c.scheduledDate;
          } else {
            const calculatedDate = calculateScheduledDate(c);
            if (calculatedDate) {
              const year = calculatedDate.getFullYear();
              const month = String(calculatedDate.getMonth() + 1).padStart(2, '0');
              const day = String(calculatedDate.getDate()).padStart(2, '0');
              scheduledDateDisplay = `${year}/${month}/${day}`;
            }
          }
          
          return {
            customerName: c.customerName,
            nextAction: c.nextAction,
            scheduledDate: c.scheduledDate,
            calculatedScheduledDate: scheduledDateDisplay,
            lastContactDate: c.lastContactDate,
            contactUrl: c.contactUrl,
          };
        }),
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

