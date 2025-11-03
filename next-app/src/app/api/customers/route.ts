import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

import type { CustomerRecord } from '@/lib/types';

const TABLE_HEADER =
  '| 顧客名 | 次のアクション | 連絡先 | ♥ | ✗ | ⭐ | 最終連絡日 | 実行予定日 | 取引回数 | 総額 | 性別 | 年齢 | 関係性/メモ |';
const TABLE_SEPARATOR =
  '|--------|-------------|--------|----|----|----|------------|----------|----------|------|------|------|-------------|';
const COLUMN_KEYS: (keyof CustomerRecord)[] = [
  'customerName',
  'nextAction',
  'contactUrl',
  'hasHeart',
  'hasTrouble',
  'isFavorite',
  'lastContactDate',
  'scheduledDate',
  'transactionCount',
  'totalAmount',
  'gender',
  'age',
  'notes',
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body || !Array.isArray(body.records)) {
      return NextResponse.json(
        { ok: false, message: '不正なリクエストです。' },
        { status: 400 },
      );
    }

    const records = (body.records as CustomerRecord[]).map((record) =>
      normalizeRecord(record),
    );
    const tableMarkdown = buildMarkdownTable(records);

    const appRoot = process.cwd();
    const publicDataPath = path.join(appRoot, 'public', 'data', 'customers.md');
    const markdownPath = path.join(appRoot, '..', '顧客管理データ.md');
    const backupDir = path.join(appRoot, '..', 'backups');

    // バックアップディレクトリを作成
    try {
      await fs.mkdir(backupDir, { recursive: true });
    } catch (error) {
      console.warn('バックアップディレクトリの作成に失敗しました。', error);
    }

    // 既存のファイルをバックアップ（タイムスタンプ付き）
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    try {
      const existingContent = await fs.readFile(publicDataPath, 'utf8');
      const backupPath = path.join(backupDir, `customers-${timestamp}.md`);
      await fs.writeFile(backupPath, existingContent, 'utf8');
      console.log(`バックアップを作成しました: ${backupPath}`);
    } catch (error) {
      console.warn('バックアップの作成に失敗しました。', error);
    }

    // データを保存
    await fs.writeFile(publicDataPath, `${tableMarkdown}\n`, 'utf8');

    let originalMarkdown = '';
    try {
      originalMarkdown = await fs.readFile(markdownPath, 'utf8');
    } catch (error) {
      console.warn('顧客管理データ.md の読み込みに失敗しました。新規作成します。', error);
    }
    const mergedMarkdown = mergeTableContents(originalMarkdown, tableMarkdown);
    await fs.writeFile(markdownPath, mergedMarkdown, 'utf8');

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('顧客データの保存に失敗しました:', error);
    return NextResponse.json(
      { ok: false, message: '保存に失敗しました。' },
      { status: 500 },
    );
  }
}

function normalizeRecord(record: CustomerRecord): CustomerRecord {
  const normalized: CustomerRecord = { ...record };
  COLUMN_KEYS.forEach((key) => {
    if (key === 'hasHeart' || key === 'hasTrouble' || key === 'isFavorite') {
      normalized[key] = Boolean(normalized[key]);
    } else {
      const value = normalized[key];
      normalized[key] = typeof value === 'string' ? value : value ?? '';
    }
  });
  return normalized;
}

function buildMarkdownTable(records: CustomerRecord[]): string {
  const rows = records.map((record) =>
    `| ${COLUMN_KEYS.map((key) => formatCell(record[key])).join(' | ')} |`,
  );
  return [TABLE_HEADER, TABLE_SEPARATOR, ...rows].join('\n');
}

function formatCell(value: string | undefined | boolean): string {
  if (value === undefined || value === null) {
    return '-';
  }
  if (typeof value === 'boolean') {
    return value ? '✓' : '-';
  }
  if (!value || value.trim() === '') {
    return '-';
  }
  return value
    .replace(/\r?\n/g, ' ')
    .replace(/\|/g, '\\|')
    .trim();
}

const OLD_TABLE_HEADER =
  '| 顧客名 | 最終連絡日 | 次のアクション | 実行予定日 | 連絡先 | 取引回数 | 総額 | 性別 | 年齢 | 関係性/メモ |';

function mergeTableContents(original: string, table: string): string {
  // 新しいヘッダーまたは古いヘッダーを検索
  const newHeaderIndex = original.indexOf(TABLE_HEADER);
  const oldHeaderIndex = original.indexOf(OLD_TABLE_HEADER);
  
  if (newHeaderIndex === -1 && oldHeaderIndex === -1) {
    return `${table}\n${original ? `${original.trimStart()}` : ''}`.trimEnd() + '\n';
  }

  const headerIndex = newHeaderIndex !== -1 ? newHeaderIndex : oldHeaderIndex;
  const headerToFind = newHeaderIndex !== -1 ? TABLE_HEADER : OLD_TABLE_HEADER;
  
  const before = original.slice(0, headerIndex);
  const afterStart = findNextSectionIndex(original, headerIndex + headerToFind.length);
  const after = original.slice(afterStart);

  const trimmedBefore = before.replace(/\s*$/, '');
  const trimmedAfter = after.replace(/^\s*/, '');

  const prefix = trimmedBefore ? `${trimmedBefore}\n` : '';
  const suffix = trimmedAfter ? `\n${trimmedAfter}` : '\n';

  return `${prefix}${table}${suffix}`.replace(/\r\n/g, '\n');
}

function findNextSectionIndex(content: string, fromIndex: number): number {
  const headingIndex = content.indexOf('\n## ', fromIndex);
  if (headingIndex === -1) {
    return content.length;
  }
  return headingIndex;
}

