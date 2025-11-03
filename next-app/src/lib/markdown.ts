import { promises as fs } from 'fs';
import path from 'path';

import type { CustomerRecord, TemplateDefinition } from '@/lib/types';

const DATA_DIR = path.join(process.cwd(), 'public', 'data');

async function readUtf8File(fileName: string): Promise<string> {
  const fullPath = path.join(DATA_DIR, fileName);
  const buffer = await fs.readFile(fullPath);
  let text = buffer.toString('utf8');
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }
  return text;
}

export async function loadCustomerRecords(): Promise<CustomerRecord[]> {
  const markdown = await readUtf8File('customers.md');
  return parseCustomerMarkdown(markdown);
}

export async function loadTemplateDefinitions(): Promise<TemplateDefinition[]> {
  const markdown = await readUtf8File('templates.md');
  return parseTemplateMarkdown(markdown);
}

export function parseCustomerMarkdown(markdownText: string): CustomerRecord[] {
  const lines = markdownText.split(/\r?\n/);
  const records: CustomerRecord[] = [];

  let inTable = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!inTable) {
      if (line.startsWith('|') && line.includes('顧客名')) {
        inTable = true;
      }
      continue;
    }

    if (line.startsWith('|---') || line === '') {
      continue;
    }

    if (!line.startsWith('|')) {
      break;
    }

    const cells = line
      .split('|')
      .map((cell) => cell.trim())
      .filter((cell) => cell !== '');

    if (cells.length < 13) {
      continue;
    }

    const [
      customerName,
      nextAction,        // データ行では2番目
      contactUrl,        // データ行では3番目
      hasHeartStr,       // データ行では4番目（♥）
      hasTroubleStr,     // データ行では5番目（✗）
      isFavoriteStr,     // データ行では6番目（⭐）
      lastContactDate,  // データ行では7番目
      scheduledDate,     // データ行では8番目
      transactionCount,  // データ行では9番目
      totalAmount,       // データ行では10番目
      gender,            // データ行では11番目
      age,               // データ行では12番目
      notes,             // データ行では13番目
    ] = cells;

    // マークのパース（✓またはtrueでtrue、それ以外はfalse）
    // 既存データに新しい列がない場合はundefinedになるため、デフォルトでfalse
    const hasHeart = hasHeartStr === '✓' || hasHeartStr === 'true';
    const hasTrouble = hasTroubleStr === '✓' || hasTroubleStr === 'true';
    const isFavorite = isFavoriteStr === '✓' || isFavoriteStr === 'true';

    records.push({
      customerName,
      lastContactDate,
      nextAction,
      scheduledDate,
      contactUrl,
      transactionCount,
      totalAmount,
      gender,
      age,
      notes,
      hasHeart: hasHeart || false,
      hasTrouble: hasTrouble || false,
      isFavorite: isFavorite || false,
    });
  }

  return records;
}

export function parseTemplateMarkdown(markdownText: string): TemplateDefinition[] {
  const codeBlockMatch = markdownText.match(/```json([\s\S]*?)```/);
  if (!codeBlockMatch) {
    return [];
  }

  try {
    const jsonText = codeBlockMatch[1];
    const parsed = JSON.parse(jsonText);
    if (Array.isArray(parsed)) {
      return parsed as TemplateDefinition[];
    }
  } catch (error) {
    console.error('Failed to parse template JSON', error);
  }

  return [];
}

