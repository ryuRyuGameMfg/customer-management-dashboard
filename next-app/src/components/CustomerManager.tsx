'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import type { ChangeEvent, ReactNode } from 'react';

import type { CustomerRecord, TemplateDefinition } from '@/lib/types';

type SortDirection = 'asc' | 'desc';

interface SortState {
  column: number | null;
  direction: SortDirection;
}

interface SettingsState {
  companyName: string;
  personName: string;
  materialUrl: string;
}

interface PreviewState {
  message: string;
  title: string;
}

interface CustomerManagerProps {
  customers: CustomerRecord[];
  templates: TemplateDefinition[];
}

const ACTION_OPTIONS = [
  '',
  '新規提案',
  'リコンタクト',
  'フォローアップ',
  'リマインド',
  'クロージング',
  '取引中',
  'リピート提案',
  '完了',
];

const ACTION_DEFINITIONS = [
  {
    name: '新規提案',
    description: '新規リードへの提案営業。初めてのコンタクトや未取引顧客へのサービス提案。',
    priority: '通常',
  },
  {
    name: 'リコンタクト',
    description: '初回返信・急ぎ対応が必要な案件。顧客からの問い合わせへの返信や緊急対応（5日以内実行）。',
    priority: '緊急',
  },
  {
    name: 'フォローアップ',
    description: '進行中案件の継続対応。提案後のフォローや迷っている顧客への情報提供・サポート（7-10日間隔）。',
    priority: '通常',
  },
  {
    name: 'リマインド',
    description: '迷っている見積もりへの再アプローチ。既存提案の進捗確認・催促。フォローアップ後の再アプローチ。',
    priority: '通常',
  },
  {
    name: 'クロージング',
    description: '決断を促す最終営業段階。契約に向けた最終的な提案や交渉。',
    priority: '重要',
  },
  {
    name: '取引中',
    description: '契約が完了し、現在進行中の案件。開発・サポート中。',
    priority: '重要',
  },
  {
    name: 'リピート提案',
    description: '取引完了後の顧客への新サービス・クーポン提案。リピート購入を促す営業活動。',
    priority: '通常',
  },
  {
    name: '完了',
    description: '取引終了・当面アクション不要。アフターサポートも含む完了状態。',
    priority: '低',
  },
];

const BUSINESS_NAME = 'ゲーム開発所RYURYU';
const OWNER_NAME = '岡本竜弥';
const OWNER_NAME_READING = 'おかもと りゅうや';
const DEFAULT_MATERIAL_URL =
  'https://drive.google.com/file/d/1s_2jWoBRvA3PiRIrd4mNqoJjTFBhBU3n/view?usp=drive_link';
const SERVICE_URL =
  'https://drive.google.com/file/d/1s_2jWoBRvA3PiRIrd4mNqoJjTFBhBU3n/view?usp=drive_link';

const DEFAULT_SETTINGS: SettingsState = {
  companyName: BUSINESS_NAME,
  personName: OWNER_NAME,
  materialUrl: DEFAULT_MATERIAL_URL,
};

const GENDER_OPTIONS = ['', '男性', '女性', '不明', 'その他'];
const AGE_OPTIONS = [
  '',
  '10代',
  '20代前半',
  '20代後半',
  '30代前半',
  '30代後半',
  '40代前半',
  '40代後半',
  '50代以上',
  '不明',
];
const TRANSACTION_OPTIONS = ['', ...Array.from({ length: 16 }, (_, index) => String(index)), '15以上'];

const DEFAULT_PREVIEW: PreviewState = {
  message: '',
  title: '',
};

const COLUMN_HEADERS = [
  '顧客名',
  '次のアクション',
  '連絡先',
  '♥',
  '✗',
  '⭐',
  '最終連絡日',
  '実行予定日',
  '取引回数',
  '総額',
  '性別',
  '年齢',
  '関係性/メモ',
];

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

const ACTION_BADGE_CLASS: Record<string, string> = {
  新規提案: 'bg-indigo-100 text-indigo-700 border border-indigo-300',
  リコンタクト: 'bg-rose-100 text-rose-700 border border-rose-300',
  フォローアップ: 'bg-sky-100 text-sky-700 border border-sky-300',
  リマインド: 'bg-emerald-100 text-emerald-700 border border-emerald-300',
  クロージング: 'bg-orange-100 text-orange-700 border border-orange-300',
  取引中: 'bg-cyan-100 text-cyan-700 border border-cyan-300',
  リピート提案: 'bg-purple-100 text-purple-700 border border-purple-300',
  完了: 'bg-gray-100 text-gray-600 border border-gray-200',
};

const URGENT_ACTIONS = new Set(['リコンタクト', 'フォローアップ']);

export default function CustomerManager({
  customers,
  templates,
}: CustomerManagerProps) {
  const [customerList, setCustomerList] = useState<CustomerRecord[]>(() =>
    customers.map((record) => ({
      ...record,
      hasHeart: record.hasHeart ?? false,
      hasTrouble: record.hasTrouble ?? false,
      isFavorite: record.isFavorite ?? false,
    })),
  );
  const [actionFilter, setActionFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortState, setSortState] = useState<SortState>({
    column: 6, // 最終連絡日
    direction: 'asc',
  });
  const settings = DEFAULT_SETTINGS;
  const [preview, setPreview] = useState<PreviewState>(DEFAULT_PREVIEW);
  const [copiedId, setCopiedId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusVariant, setStatusVariant] = useState<'success' | 'error' | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const customerListRef = useRef(customerList);

  // customerListが変更されたらrefを更新
  useEffect(() => {
    customerListRef.current = customerList;
  }, [customerList]);

  useEffect(() => {
    if (!statusMessage) return undefined;
    const timer = window.setTimeout(() => {
      setStatusMessage(null);
      setStatusVariant(null);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [statusMessage]);

  // 自動保存機能: isDirtyがtrueになったら2秒後に自動保存
  useEffect(() => {
    if (!isDirty || isSaving) return undefined;

    const timer = window.setTimeout(async () => {
      setIsSaving(true);
      setStatusMessage(null);
      setStatusVariant(null);
      try {
        await persistCustomerRecords(customerListRef.current);
        setIsDirty(false);
        setStatusMessage('自動保存しました。');
        setStatusVariant('success');
      } catch (error) {
        console.error('Failed to auto-save customer data', error);
        setStatusMessage(error instanceof Error ? error.message : '自動保存に失敗しました。');
        setStatusVariant('error');
      } finally {
        setIsSaving(false);
      }
    }, 2000); // 2秒後に自動保存

    return () => window.clearTimeout(timer);
  }, [isDirty, isSaving]);

  const handleCellChange = (
    recordIndex: number,
    field: keyof CustomerRecord,
    value: string | boolean,
  ) => {
    // 実行予定日は編集不可なので、変更を無視する
    if (field === 'scheduledDate') {
      return;
    }

    setCustomerList((prev) =>
      prev.map((item, index) => {
        if (index === recordIndex) {
          const updated = { ...item, [field]: value };
          // 次のアクションまたは最終連絡日が変更された場合、実行予定日を自動計算
          if (field === 'nextAction' || field === 'lastContactDate') {
            updated.scheduledDate = calculateScheduledDate(updated);
          }
          return updated;
        }
        return item;
      }),
    );
    setIsDirty(true);
    if (statusVariant !== null) {
      setStatusMessage(null);
      setStatusVariant(null);
    }
  };

  const handleMarkToggle = (
    recordIndex: number,
    field: 'hasHeart' | 'hasTrouble' | 'isFavorite',
    customerName?: string,
  ) => {
    setCustomerList((prev) =>
      prev.map((item, index) => {
        // recordIndexとcustomerNameの両方でマッチングを試みる
        const matchesByIndex = index === recordIndex;
        const matchesByName = customerName && item.customerName === customerName;
        
        if (matchesByIndex || matchesByName) {
          const currentValue = Boolean(item[field]);
          return { ...item, [field]: !currentValue };
        }
        return item;
      }),
    );
    setIsDirty(true);
    if (statusVariant !== null) {
      setStatusMessage(null);
      setStatusVariant(null);
    }
  };

  const handleSaveAll = async () => {
    if (!isDirty) {
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);
    setStatusVariant(null);
    try {
      await persistCustomerRecords(customerList);
      setIsDirty(false);
      setStatusMessage('顧客データを保存しました。');
      setStatusVariant('success');
    } catch (error) {
      console.error('Failed to save customer data', error);
      setStatusMessage(error instanceof Error ? error.message : '保存に失敗しました。');
      setStatusVariant('error');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredRecords = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return customerList.filter((record) => {
      const actionMatch =
        !actionFilter || record.nextAction?.includes(actionFilter);

      if (!actionMatch) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return Object.values(record).some((value) => {
        // null, undefined, booleanを安全に処理
        if (value === null || value === undefined) {
          return false;
        }
        if (typeof value === 'boolean') {
          return false; // boolean値は検索対象外
        }
        if (typeof value === 'string') {
          return value.toLowerCase().includes(normalizedSearch);
        }
        // その他の型は文字列に変換して検索
        return String(value).toLowerCase().includes(normalizedSearch);
      });
    });
  }, [customerList, actionFilter, searchTerm]);

  const sortedRecords = useMemo(() => {
    if (sortState.column === null) {
      return filteredRecords;
    }

    const sorted = [...filteredRecords];

    sorted.sort((a, b) => {
      const columnIndex = sortState.column ?? 0;
      const valueA = getColumnValue(a, columnIndex);
      const valueB = getColumnValue(b, columnIndex);

      if (valueA < valueB) return sortState.direction === 'asc' ? -1 : 1;
      if (valueA > valueB) return sortState.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [filteredRecords, sortState]);

  const stats = useMemo(() => {
    const totalCustomers = sortedRecords.length;
    const totalAmount = sortedRecords.reduce((sum, record) => {
      return sum + parseAmount(record.totalAmount);
    }, 0);

    const actionCounts = new Map<string, number>();
    let urgentCount = 0;

    // 有効なアクション名のセットを作成
    const validActions = new Set(ACTION_OPTIONS.filter(Boolean));

    sortedRecords.forEach((record) => {
      const action = record.nextAction || '未設定';
      
      // アクション名が有効なものかチェック（URLを含む場合は除外）
      const isValidAction = validActions.has(action) && !action.includes('http') && !action.includes('[');
      
      if (isValidAction) {
        actionCounts.set(action, (actionCounts.get(action) ?? 0) + 1);
        if (URGENT_ACTIONS.has(action)) {
          urgentCount += 1;
        }
      } else if (!action || action === '未設定' || action.trim() === '') {
        actionCounts.set('未設定', (actionCounts.get('未設定') ?? 0) + 1);
      }
    });

    // 未設定を除外してトップアクションを取得
    const topAction = Array.from(actionCounts.entries())
      .filter(([action]) => action !== '未設定')
      .sort((a, b) => b[1] - a[1])[0]?.[0];

    return {
      totalCustomers,
      totalAmount,
      urgentCount,
      topAction: topAction ?? 'N/A',
    };
  }, [sortedRecords]);

  const handleSort = (columnIndex: number) => {
    setSortState((prev) => {
      if (prev.column === columnIndex) {
        return {
          column: columnIndex,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      return { column: columnIndex, direction: 'asc' };
    });
  };

  const clearFilters = () => {
    setActionFilter('');
    setSearchTerm('');
  };

  const handleCopy = async (record: CustomerRecord) => {
    const template = selectTemplate(record, templates);
    if (!template) {
      window.alert('対応するテンプレートが見つかりませんでした。');
      return;
    }

    const message = generateMessage(record, template, settings);
    try {
      await copyToClipboard(message);
      setPreview({ message, title: template.title });
      setCopiedId(`${record.customerName}-${template.id}`);
      window.setTimeout(() => setCopiedId(''), 1500);
    } catch (error) {
      console.error('コピーに失敗しました', error);
      window.prompt('コピーできませんでした。以下を手動でコピーしてください。', message);
    }
  };

  const resetPreview = () => setPreview(DEFAULT_PREVIEW);

  const [showActionDefinitions, setShowActionDefinitions] = useState(false);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[2000px] flex-col gap-6 px-6 py-10 lg:px-12">
      <header className="flex flex-col gap-3">
        <p className="text-sm uppercase tracking-[0.4em] text-sky-300">
          Customer Relationship
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          顧客管理ダッシュボード
        </h1>
        <p className="text-sm text-slate-300">
          顧客ごとの状況を把握し、最適なメッセージをワンクリックでコピーできます。
        </p>
      </header>

      <section className="grid gap-4 rounded-2xl bg-slate-900/60 p-5 shadow-lg shadow-slate-950/40 backdrop-blur relative">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-2">
          <FilterSelect
            label="次のアクション"
            value={actionFilter}
            onChange={setActionFilter}
          />
          <FilterInput
            label="検索"
            placeholder="顧客名・メモなど"
            value={searchTerm}
            onChange={setSearchTerm}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
          >
            フィルターをリセット
          </button>
          <p className="text-xs text-slate-400">検索条件をクリアします。</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-xs text-slate-400">
            {isSaving
              ? '自動保存中...'
              : isDirty
              ? '変更を検出しました。2秒後に自動保存されます。'
              : '最新の状態です（自動保存済み）。'}
          </div>
        </div>
        {/* 右上にオーバーレイ通知 */}
        {statusMessage ? (
          <div
            className={`fixed top-4 right-4 z-50 rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur-sm transition-all ${
              statusVariant === 'success'
                ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-200'
                : 'border-rose-500/50 bg-rose-500/20 text-rose-200'
            }`}
          >
            {statusMessage}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-slate-950/30">
        <button
          type="button"
          onClick={() => setShowActionDefinitions(!showActionDefinitions)}
          className="flex w-full items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-200">アクション定義</span>
            <span className="text-xs text-slate-500">（クリックで展開）</span>
          </div>
          <span className="text-slate-400">
            {showActionDefinitions ? '▲' : '▼'}
          </span>
        </button>
        {showActionDefinitions && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ACTION_DEFINITIONS.map((action) => (
              <div
                key={action.name}
                className="rounded-lg border border-slate-700 bg-slate-900/80 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">
                        {action.name}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          action.priority === '緊急'
                            ? 'bg-rose-500/20 text-rose-300'
                            : action.priority === '重要'
                            ? 'bg-orange-500/20 text-orange-300'
                            : action.priority === '低'
                            ? 'bg-gray-500/20 text-gray-400'
                            : 'bg-sky-500/20 text-sky-300'
                        }`}
                      >
                        {action.priority}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">
                      {action.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <StatsBar stats={stats} />

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 shadow-xl shadow-slate-950/40">
        <div className="flex items-center justify-end px-4 pt-3 text-xs text-slate-500">
          横スクロールで詳細項目をご確認いただけます。
        </div>
        <div className="overflow-x-scroll overflow-y-scroll" style={{ maxHeight: 'calc(100vh - 300px)', minHeight: '20000px' }}>
          <table className="min-w-[1600px] w-full border-collapse text-sm text-slate-100">
            <thead className="bg-slate-900/90 text-left text-xs uppercase tracking-wider text-slate-300">
              <tr>
                {COLUMN_HEADERS.map((header, index) => {
                  const isMarkColumn = index >= 3 && index < 6; // hasHeart, hasTrouble, isFavorite の列（SVGアイコン表示）
                  const isFixedColumn = index < 6; // 固定列
                  return (
                    <th
                      key={header}
                      className={`whitespace-nowrap border-b border-slate-800 px-4 py-3 font-semibold ${
                        isMarkColumn ? 'text-center' : ''
                      } ${
                        isFixedColumn
                          ? 'sticky z-20 bg-slate-900/95 shadow-[2px_0_4px_rgba(0,0,0,0.3)]'
                          : ''
                      }`}
                      style={
                        isFixedColumn
                          ? {
                              left:
                                index === 0
                                  ? '0px'
                                  : index === 1
                                  ? '180px'
                                  : index === 2
                                  ? '360px'
                                  : index === 3
                                  ? '480px'
                                  : index === 4
                                  ? '520px'
                                  : '560px',
                            }
                          : {}
                      }
                    >
                      {isMarkColumn ? (
                        <button
                          type="button"
                          onClick={() => handleSort(index)}
                          className="flex items-center justify-center gap-2 mx-auto"
                        >
                          {index === 3 ? (
                            // ハートアイコン
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              className="h-5 w-5 fill-red-400 stroke-red-400"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                            </svg>
                          ) : index === 4 ? (
                            // バツアイコン
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              className="h-5 w-5 fill-none stroke-orange-400"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          ) : (
                            // スターアイコン
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              className="h-5 w-5 fill-yellow-400 stroke-yellow-400"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                          )}
                          <SortIndicator
                            active={sortState.column === index}
                            direction={sortState.direction}
                          />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSort(index)}
                          className="flex items-center gap-2 text-left"
                        >
                          {header}
                          <SortIndicator
                            active={sortState.column === index}
                            direction={sortState.direction}
                          />
                        </button>
                      )}
                    </th>
                  );
                })}
                <th className="sticky right-0 z-20 whitespace-nowrap border-b border-slate-800 bg-slate-900/95 px-4 py-3 font-semibold shadow-[-2px_0_4px_rgba(0,0,0,0.3)]">
                  テンプレート
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRecords.map((record) => {
                const recordIndex = findRecordIndex(record, customerList);
                const template = selectTemplate(record, templates);

                return (
                  <tr
                    key={`${record.customerName || '未設定'}-${record.nextAction || '未設定'}-${record.scheduledDate || ''}-${recordIndex}`}
                    className="border-b border-slate-800/60 bg-slate-900/40 transition hover:bg-slate-800/40"
                  >
                    {COLUMN_KEYS.map((key, index) => {
                      const isFixedColumn = index < 6; // 顧客名、次のアクション、連絡先、マーク列
                      const cellClass = getCellClass(key);
                      return (
                        <td
                          key={key}
                          className={`${cellClass} ${
                            isFixedColumn
                              ? 'sticky z-10 bg-slate-900/95 shadow-[2px_0_4px_rgba(0,0,0,0.3)]'
                              : ''
                          }`}
                          style={
                            isFixedColumn
                              ? {
                                  left:
                                    index === 0
                                      ? '0px'
                                      : index === 1
                                      ? '180px'
                                      : index === 2
                                      ? '360px'
                                      : index === 3
                                      ? '480px'
                                      : index === 4
                                      ? '520px'
                                      : '560px',
                                }
                              : {}
                          }
                        >
                          {renderEditableField(record, recordIndex, key, handleCellChange, handleMarkToggle)}
                        </td>
                      );
                    })}
                    <td className="sticky right-0 z-10 bg-slate-900/95 px-4 py-3 text-slate-200 shadow-[-2px_0_4px_rgba(0,0,0,0.3)]">
                      <div className="flex flex-col gap-2">
                        {template ? (
                          <button
                            type="button"
                            onClick={() => handleCopy(record)}
                            className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 transition hover:bg-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:opacity-60"
                            disabled={isSaving}
                          >
                            {copiedId === `${record.customerName}-${template.id}`
                              ? 'コピー済み'
                              : 'コピー'}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-500">テンプレート未設定</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 shadow-lg shadow-slate-950/30">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">コピーしたメッセージ</h2>
            <p className="text-xs text-slate-400">
              直近でコピーしたテンプレート内容が表示されます。
            </p>
          </div>
          <button
            type="button"
            onClick={resetPreview}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 transition hover:bg-slate-800"
          >
            クリア
          </button>
        </div>
        <textarea
          className="mt-4 h-48 w-full resize-none rounded-xl border border-slate-700 bg-slate-950/70 p-4 text-sm leading-relaxed text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          value={preview.message}
          readOnly
          placeholder="ここにコピーしたメッセージが表示されます。"
        />
        {preview.title ? (
          <p className="mt-2 text-xs text-emerald-300">{preview.title}</p>
        ) : null}
      </section>
    </div>
  );
}

function getColumnValue(record: CustomerRecord, columnIndex: number): number | string {
  switch (columnIndex) {
    case 8:
      return parseInt(record.transactionCount, 10) || 0;
    case 9:
      return parseAmount(record.totalAmount);
    case 6:
    case 7:
      return recordValueToDate(record, columnIndex).getTime();
    case 3:
      return record.hasHeart ? '1' : '0';
    case 4:
      return record.hasTrouble ? '1' : '0';
    case 5:
      return record.isFavorite ? '1' : '0';
    default:
      const key = COLUMN_KEYS[columnIndex];
      if (!key) return '';
      const value = record[key];
      if (typeof value === 'boolean') {
        return value ? '1' : '0';
      }
      return value ?? '';
  }
}

function recordValueToDate(record: CustomerRecord, columnIndex: number): Date {
  const key = COLUMN_KEYS[columnIndex];
  if (!key) return new Date('1900-01-01');
  const value = record[key] as string | undefined;
  if (!value) {
    return new Date('1900-01-01');
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date('1900-01-01');
  }
  return parsed;
}

function parseAmount(value: string): number {
  if (!value) return 0;
  const matches = value.match(/\d+(?:\.\d+)?/g);
  if (!matches) return 0;
  let amount = 0;
  if (matches.length === 1) {
    amount = parseFloat(matches[0]) || 0;
  } else {
    const first = parseFloat(matches[0]) || 0;
    const second = parseFloat(matches[1]) || first;
    amount = (first + second) / 2;
  }
  if (/万/.test(value)) {
    amount *= 10000;
  }
  return Math.round(amount);
}

function parseContact(value: string) {
  if (!value) return null;
  const markdownMatch = value.match(/\[([^\]]+)]\(([^)]+)\)/);
  if (markdownMatch) {
    return {
      label: markdownMatch[1],
      url: markdownMatch[2],
    };
  }
  if (value.startsWith('http')) {
    return {
      label: '開く',
      url: value,
    };
  }
  return null;
}

function getActionKeyword(action: string) {
  return Object.keys(ACTION_BADGE_CLASS).find((keyword) => action.includes(keyword)) ?? action;
}

function isExistingCustomer(record: CustomerRecord) {
  const count = parseInt(record.transactionCount, 10);
  const amount = parseAmount(record.totalAmount);
  return (Number.isFinite(count) && count > 0) || amount > 0;
}

function selectTemplate(
  record: CustomerRecord,
  templates: TemplateDefinition[],
): TemplateDefinition | null {
  const action = getActionKeyword(record.nextAction);
  const candidates = templates.filter((template) =>
    template.actions?.some((candidate) => action.includes(candidate)),
  );

  if (candidates.length === 0) {
    return null;
  }

  const existing = isExistingCustomer(record);

  for (const template of candidates) {
    if (!template.condition) {
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(template.condition, 'existing')) {
      if (template.condition.existing === existing) {
        return template;
      }
    }
  }

  return candidates.find((candidate) => !candidate.condition) ?? candidates[0] ?? null;
}

function getCellClass(key: keyof CustomerRecord): string {
  switch (key) {
    case 'customerName':
      return 'whitespace-nowrap px-4 py-3 font-semibold text-white';
    case 'nextAction':
      return 'whitespace-nowrap px-4 py-3';
    case 'contactUrl':
      return 'whitespace-nowrap px-4 py-3 text-center';
    case 'transactionCount':
      return 'whitespace-nowrap px-4 py-3 text-center text-slate-200';
    case 'totalAmount':
      return 'whitespace-nowrap px-4 py-3 text-right font-semibold text-emerald-400';
    case 'gender':
    case 'age':
      return 'whitespace-nowrap px-4 py-3 text-center text-slate-200';
    case 'notes':
      return 'px-4 py-3 text-slate-300';
    case 'hasHeart':
    case 'hasTrouble':
    case 'isFavorite':
      return 'whitespace-nowrap px-4 py-3 text-center';
    default:
      return 'whitespace-nowrap px-4 py-3 text-slate-200';
  }
}

function renderEditableField(
  record: CustomerRecord,
  recordIndex: number,
  key: keyof CustomerRecord,
  onChange: (
    recordIndex: number,
    field: keyof CustomerRecord,
    value: string | boolean,
  ) => void,
  onMarkToggle?: (
    recordIndex: number,
    field: 'hasHeart' | 'hasTrouble' | 'isFavorite',
    customerName?: string,
  ) => void,
): ReactNode {
  const rawValue = record[key];
  const value = typeof rawValue === 'boolean' ? '' : (rawValue ?? '');

  if (key === 'hasHeart') {
    const hasHeart = Boolean(record.hasHeart);
    return (
      <button
        type="button"
        onClick={() => onMarkToggle?.(recordIndex, 'hasHeart', record.customerName)}
        className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full transition hover:scale-110 ${
          hasHeart
            ? 'bg-red-500/20'
            : 'hover:bg-slate-800'
        }`}
        title={hasHeart ? 'ハートを外す' : 'ハートを付ける'}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className={`h-5 w-5 transition ${
            hasHeart
              ? 'fill-red-400 stroke-red-400'
              : 'fill-none stroke-slate-500 hover:stroke-red-400'
          }`}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </button>
    );
  }

  if (key === 'hasTrouble') {
    const hasTrouble = Boolean(record.hasTrouble);
    return (
      <button
        type="button"
        onClick={() => onMarkToggle?.(recordIndex, 'hasTrouble', record.customerName)}
        className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full transition hover:scale-110 ${
          hasTrouble
            ? 'bg-orange-500/20'
            : 'hover:bg-slate-800'
        }`}
        title={hasTrouble ? 'トラブルマークを外す' : 'トラブルマークを付ける'}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className={`h-5 w-5 transition ${
            hasTrouble
              ? 'fill-orange-400 stroke-orange-400'
              : 'fill-none stroke-slate-500 hover:stroke-orange-400'
          }`}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    );
  }

  if (key === 'isFavorite') {
    const isFavorite = Boolean(record.isFavorite);
    return (
      <button
        type="button"
        onClick={() => onMarkToggle?.(recordIndex, 'isFavorite', record.customerName)}
        className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full transition hover:scale-110 ${
          isFavorite
            ? 'bg-yellow-500/20'
            : 'hover:bg-slate-800'
        }`}
        title={isFavorite ? 'お気に入りを外す' : 'お気に入りにする'}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className={`h-5 w-5 transition ${
            isFavorite
              ? 'fill-yellow-400 stroke-yellow-400'
              : 'fill-none stroke-slate-500 hover:stroke-yellow-400'
          }`}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </button>
    );
  }

  if (key === 'nextAction') {
    return (
      <select
        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        value={value}
        onChange={(event) => onChange(recordIndex, key, event.target.value)}
      >
        <option value="">未設定</option>
        {ACTION_OPTIONS.filter(Boolean).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  if (key === 'notes') {
    return (
      <textarea
        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        value={value}
        onChange={(event) => onChange(recordIndex, key, event.target.value)}
        rows={3}
      />
    );
  }

  if (key === 'gender') {
    return (
      <select
        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        value={value}
        onChange={(event) => onChange(recordIndex, key, event.target.value)}
      >
        {GENDER_OPTIONS.map((option) => (
          <option key={option || '未設定'} value={option}>
            {option || '未設定'}
          </option>
        ))}
      </select>
    );
  }

  if (key === 'age') {
    return (
      <select
        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        value={value}
        onChange={(event) => onChange(recordIndex, key, event.target.value)}
      >
        {AGE_OPTIONS.map((option) => (
          <option key={option || '未設定'} value={option}>
            {option || '未設定'}
          </option>
        ))}
      </select>
    );
  }

  if (key === 'transactionCount') {
    return (
      <select
        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        value={value}
        onChange={(event) => onChange(recordIndex, key, event.target.value)}
      >
        {TRANSACTION_OPTIONS.map((option) => (
          <option key={option || '未設定'} value={option}>
            {option || '未設定'}
          </option>
        ))}
      </select>
    );
  }

  if (key === 'contactUrl') {
    const contact = parseContact(value);
    const url = contact?.url || value;

    if (!url) {
      return <span className="text-sm text-slate-500">-</span>;
    }

    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center rounded-md bg-sky-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-sky-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
      >
        DMを開く
      </a>
    );
  }

  if (key === 'totalAmount') {
    return (
      <input
        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-emerald-400 text-right focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        value={value}
        onChange={(event) => onChange(recordIndex, key, event.target.value)}
        placeholder="0円"
      />
    );
  }

  if (key === 'lastContactDate') {
    const inputValue = formatDateForInput(value);
    return (
      <input
        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        value={inputValue}
        onChange={(event) =>
          onChange(recordIndex, key, formatDateFromInput(event.target.value))
        }
        type="date"
      />
    );
  }

  if (key === 'scheduledDate') {
    // 実行予定日は自動計算して編集不可にする
    const calculatedDate = calculateScheduledDate(record);
    const displayValue = calculatedDate || '未設定';
    const inputValue = formatDateForInput(calculatedDate);
    return (
      <input
        className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
        value={inputValue}
        type="date"
        readOnly
        disabled
        title="実行予定日は自動計算されます"
      />
    );
  }

  const inputType = 'text';

  const commonProps = {
    className:
      'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
    value,
    onChange: (event: ChangeEvent<HTMLInputElement>) =>
      onChange(recordIndex, key, event.target.value),
  } as const;

  return (
    <input
      {...commonProps}
      type={inputType}
    />
  );
}

function findRecordIndex(record: CustomerRecord, list: CustomerRecord[]): number {
  const directIndex = list.indexOf(record);
  if (directIndex !== -1) {
    return directIndex;
  }
  // customerNameを主キーとして使用し、より確実に一致するレコードを探す
  const fallbackIndex = list.findIndex((item) =>
    item.customerName === record.customerName &&
    item.lastContactDate === record.lastContactDate &&
    item.nextAction === record.nextAction &&
    item.contactUrl === record.contactUrl,
  );
  return fallbackIndex === -1 ? 0 : fallbackIndex;
}

function formatDateForInput(value: string): string {
  if (!value || value === '-' || value === '未設定') {
    return '';
  }
  const normalized = value
    .replace(/年|月/g, '-')
    .replace(/日/g, '')
    .replace(/\./g, '-')
    .replace(/\//g, '-');
  const parts = normalized.split('-').map((part) => part.trim()).filter(Boolean);
  if (parts.length !== 3) {
    return '';
  }
  const [year, month, day] = parts;
  if (year.length !== 4) {
    return '';
  }
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function formatDateFromInput(value: string): string {
  if (!value) {
    return '';
  }
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) {
    return value;
  }
  return `${year}/${month}/${day}`;
}

function calculateScheduledDate(record: CustomerRecord): string {
  const { nextAction, lastContactDate } = record;
  
  // アクションが設定されていない場合は空文字を返す
  if (!nextAction || nextAction === '未設定' || nextAction === '') {
    return '';
  }

  // 最終連絡日が設定されていない場合は空文字を返す
  const lastDate = parseLastContactDate(lastContactDate);
  if (!lastDate) {
    return '';
  }

  const now = new Date();
  let daysToAdd = 0;

  // アクション種類に応じて日数を計算
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
    return ''; // 完了の場合は実行予定日なし
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

  // YYYY/MM/DD形式で返す
  const year = scheduledDate.getFullYear();
  const month = String(scheduledDate.getMonth() + 1).padStart(2, '0');
  const day = String(scheduledDate.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

async function persistCustomerRecords(records: CustomerRecord[]): Promise<void> {
  const response = await fetch('/api/customers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ records }),
  });

  if (!response.ok) {
    let message = '保存に失敗しました。';
    try {
      const data = await response.json();
      if (data?.message) {
        message = data.message;
      }
    } catch (error) {
      console.warn('Failed to parse error response', error);
    }
    throw new Error(message);
  }
}

const MS_PER_DAY = 86_400_000;

function formatPersonName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return `${OWNER_NAME}（${OWNER_NAME_READING}）`;
  }
  if (trimmed.includes('（') && trimmed.includes('）')) {
    return trimmed;
  }
  return `${trimmed}（${OWNER_NAME_READING}）`;
}

function buildGreetingPhrase(
  record: CustomerRecord,
  companyName: string,
  personDisplay: string,
): string {
  const count = parseInt(record.transactionCount, 10);
  const lastDate = parseLastContactDate(record.lastContactDate);
  const now = new Date();
  const diffDays = lastDate ? Math.max(0, Math.floor((now.getTime() - lastDate.getTime()) / MS_PER_DAY)) : null;

  let prefix: string;

  if (!Number.isFinite(count) || count <= 0) {
    prefix = 'はじめまして';
  } else if (count === 1) {
    if (diffDays === null) {
      prefix = '以前はありがとうございました';
    } else if (diffDays > 365) {
      prefix = 'お久しぶりです';
    } else if (diffDays > 90) {
      prefix = '以前はありがとうございました';
    } else {
      prefix = '先日はありがとうございました';
    }
  } else {
    if (diffDays === null) {
      prefix = 'いつもお世話になっております';
    } else if (diffDays > 365) {
      prefix = 'お久しぶりです';
    } else if (diffDays > 120) {
      prefix = 'いつもお世話になっております';
    } else {
      prefix = 'いつもありがとうございます';
    }
  }

  return `${prefix}、${companyName}の${personDisplay}です。`;
}

function parseLastContactDate(value: string | undefined): Date | null {
  if (!value || value === '-' || value === '未設定') {
    return null;
  }
  const normalized = value.replace(/年|月/g, '/').replace(/日/g, '').replace(/\s/g, '');
  const parts = normalized.split('/');
  if (parts.length < 3) {
    return null;
  }
  const [year, month, day] = parts.map((part) => parseInt(part, 10));
  if (!year || !month || !day) {
    return null;
  }
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function buildSignature(companyName: string, personDisplay: string, materialUrl: string): string {
  return `${companyName}\n${personDisplay}\nサービス資料：${materialUrl || SERVICE_URL}`;
}

function generateMessage(
  record: CustomerRecord,
  template: TemplateDefinition,
  settings: SettingsState,
) {
  const defaults: SettingsState = {
    companyName: settings.companyName || BUSINESS_NAME,
    personName: settings.personName || OWNER_NAME,
    materialUrl: settings.materialUrl || DEFAULT_MATERIAL_URL,
  };

  const personDisplay = formatPersonName(defaults.personName);
  const greeting = buildGreetingPhrase(record, defaults.companyName, personDisplay);
  const signature = buildSignature(defaults.companyName, personDisplay, defaults.materialUrl);

  const replacements: Record<string, string> = {
    '{{顧客名}}': record.customerName || '',
    '{{自社名}}': defaults.companyName,
    '{{事業名}}': defaults.companyName,
    '{{担当者名}}': personDisplay,
    '{{氏名}}': defaults.personName,
    '{{氏名読み}}': OWNER_NAME_READING,
    '{{資料URL}}': defaults.materialUrl,
    '{{サービスURL}}': SERVICE_URL,
    '{{最終連絡日}}': record.lastContactDate || '未設定',
    '{{次のアクション}}': record.nextAction || '未設定',
    '{{実行予定日}}': record.scheduledDate || '未設定',
    '{{連絡先}}': parseContact(record.contactUrl)?.url || record.contactUrl || '',
    '{{取引回数}}': record.transactionCount || '0',
    '{{総額}}': record.totalAmount || '0円',
    '{{関係性メモ}}': inferMemo(record),
    '{{目安日程}}': '＜目安日程をご記入ください＞',
    '{{候補日時}}': '＜候補日時をご記入ください＞',
    '{{提案プラン名}}': '＜提案プラン名をご記入ください＞',
    '{{挨拶文}}': greeting,
    '{{署名}}': signature,
  };

  return replacePlaceholders(template.template, replacements);
}

function inferMemo(record: CustomerRecord) {
  if (record.notes && record.notes !== '-') {
    return record.notes;
  }
  if (record.nextAction.includes('フォローアップ')) {
    return '現在進行中の案件';
  }
  if (record.nextAction.includes('新規提案')) {
    return 'これまでのやり取り';
  }
  return 'これまでの案件';
}

function replacePlaceholders(text: string, replacements: Record<string, string>) {
  return Object.entries(replacements).reduce((acc, [key, value]) => {
    const pattern = new RegExp(key.replace(/[.*+?^${}()|[\]\\{}]/g, '\\$&'), 'g');
    return acc.replace(pattern, value ?? '');
  }, text);
}

async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.top = '-1000px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function FilterSelect({ label, value, onChange }: FilterSelectProps) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
      <span>{label}</span>
      <select
        className="h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-white shadow-inner shadow-slate-950/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {ACTION_OPTIONS.map((option) => (
          <option key={option || 'all'} value={option}>
            {option || 'すべて'}
          </option>
        ))}
      </select>
    </label>
  );
}

interface FilterInputProps {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  className?: string;
}

function FilterInput({ label, value, placeholder, onChange, className }: FilterInputProps) {
  return (
    <label
      className={`flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400 ${className ?? ''}`}
    >
      <span>{label}</span>
      <input
        className="h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-white shadow-inner shadow-slate-950/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

interface SortIndicatorProps {
  active: boolean;
  direction: SortDirection;
}

function SortIndicator({ active, direction }: SortIndicatorProps) {
  if (!active) {
    return <span className="text-slate-600">↕</span>;
  }

  return (
    <span className="text-emerald-400">{direction === 'asc' ? '↑' : '↓'}</span>
  );
}

interface StatsBarProps {
  stats: {
    totalCustomers: number;
    totalAmount: number;
    urgentCount: number;
    topAction: string;
  };
}

function StatsBar({ stats }: StatsBarProps) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="総顧客数" value={`${stats.totalCustomers} 名`} />
      <StatCard
        label="総売上"
        value={`¥${stats.totalAmount.toLocaleString()}`}
        accent
      />
      <StatCard label="要対応顧客" value={`${stats.urgentCount} 名`} />
      <StatCard label="主要アクション" value={stats.topAction} />
    </section>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  accent?: boolean;
}

function StatCard({ label, value, accent = false }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-inner shadow-black/30">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{label}</p>
      <p
        className={`mt-3 text-2xl font-semibold ${
          accent ? 'text-emerald-300' : 'text-white'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

