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
  '⭐',
  '✗',
  '顧客名',
  '次のアクション',
  '連絡先',
  '最終連絡日',
  '実行予定日',
  '取引回数',
  '総額',
  '性別',
  '年齢',
  '関係性/メモ',
];

const COLUMN_KEYS: (keyof CustomerRecord)[] = [
  'isFavorite',
  'hasTrouble',
  'customerName',
  'nextAction',
  'contactUrl',
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
      hasTrouble: record.hasTrouble ?? false,
      isFavorite: record.isFavorite ?? false,
    })),
  );
  const [actionFilter, setActionFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFavorite, setFilterFavorite] = useState<boolean | null>(null);
  const [filterTrouble, setFilterTrouble] = useState<boolean | null>(null);
  const [filterGender, setFilterGender] = useState('');
  const [filterAge, setFilterAge] = useState('');
  const [filterTransactionMin, setFilterTransactionMin] = useState('');
  const [sortState, setSortState] = useState<SortState>({
    column: 5, // 最終連絡日（星、バツ、顧客名、次のアクション、連絡先の後）
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
      // アクションフィルター
      const actionMatch =
        !actionFilter || record.nextAction?.includes(actionFilter);
      if (!actionMatch) {
        return false;
      }

      // お気に入りフィルター
      if (filterFavorite !== null && record.isFavorite !== filterFavorite) {
        return false;
      }

      // トラブルフィルター
      if (filterTrouble !== null && record.hasTrouble !== filterTrouble) {
        return false;
      }

      // 性別フィルター
      if (filterGender && record.gender !== filterGender) {
        return false;
      }

      // 年齢フィルター
      if (filterAge && record.age !== filterAge) {
        return false;
      }

      // 取引回数フィルター
      if (filterTransactionMin) {
        const transactionCount = parseInt(record.transactionCount, 10) || 0;
        const minCount = parseInt(filterTransactionMin, 10);
        if (transactionCount < minCount) {
          return false;
        }
      }

      // 検索フィルター
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
  }, [customerList, actionFilter, searchTerm, filterFavorite, filterTrouble, filterGender, filterAge, filterTransactionMin]);

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

    // 今月の新規顧客数を計算
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const newCustomersThisMonth = customerList.filter((record) => {
      const transactionCount = parseInt(record.transactionCount, 10) || 0;
      if (transactionCount !== 0) return false;
      
      const lastContactDate = parseLastContactDate(record.lastContactDate);
      return lastContactDate && lastContactDate >= thisMonthStart;
    }).length;

    // 今月のコンタクト数を計算
    const contactsThisMonth = customerList.filter((record) => {
      const lastContactDate = parseLastContactDate(record.lastContactDate);
      return lastContactDate && lastContactDate >= thisMonthStart;
    }).length;

    // 日次コンタクト数（過去30日）
    const dailyContacts: { date: Date; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dateEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
      
      const dayCount = customerList.filter((record) => {
        const lastContactDate = parseLastContactDate(record.lastContactDate);
        return lastContactDate && lastContactDate >= dateStart && lastContactDate < dateEnd;
      }).length;
      
      dailyContacts.push({ date, count: dayCount });
    }

    // 月次コンタクト数（過去12ヶ月）
    const monthlyContacts: { month: Date; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const monthCount = customerList.filter((record) => {
        const lastContactDate = parseLastContactDate(record.lastContactDate);
        return lastContactDate && lastContactDate >= monthStart && lastContactDate <= monthEnd;
      }).length;
      
      monthlyContacts.push({ month: monthStart, count: monthCount });
    }

    // 過去6ヶ月の売上推移を計算
    const monthlySales: { month: Date; amount: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const monthTotal = customerList.reduce((sum, record) => {
        const lastContactDate = parseLastContactDate(record.lastContactDate);
        if (lastContactDate && lastContactDate >= monthStart && lastContactDate <= monthEnd) {
          return sum + parseAmount(record.totalAmount);
        }
        return sum;
      }, 0);
      
      monthlySales.push({ month: monthStart, amount: monthTotal });
    }

    // 過去3年の売上推移を計算
    const yearlySales: { year: number; amount: number }[] = [];
    for (let i = 2; i >= 0; i--) {
      const year = now.getFullYear() - i;
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year, 11, 31);
      
      const yearTotal = customerList.reduce((sum, record) => {
        const lastContactDate = parseLastContactDate(record.lastContactDate);
        if (lastContactDate && lastContactDate >= yearStart && lastContactDate <= yearEnd) {
          return sum + parseAmount(record.totalAmount);
        }
        return sum;
      }, 0);
      
      yearlySales.push({ year, amount: yearTotal });
    }

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

    return {
      totalCustomers,
      totalAmount,
      urgentCount,
      newCustomersThisMonth,
      contactsThisMonth,
      dailyContacts,
      monthlyContacts,
      monthlySales,
      yearlySales,
    };
  }, [sortedRecords, customerList]);

  // デバッグ用: 統計データの確認
  useEffect(() => {
    console.log('📊 Stats Debug:', {
      dailyContacts: stats.dailyContacts.length,
      monthlyContacts: stats.monthlyContacts.length,
      monthlySales: stats.monthlySales.length,
      yearlySales: stats.yearlySales.length,
      dailyContactsSample: stats.dailyContacts.slice(0, 3),
      monthlySalesSample: stats.monthlySales.slice(0, 3),
    });
  }, [stats]);

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
    setFilterFavorite(null);
    setFilterTrouble(null);
    setFilterGender('');
    setFilterAge('');
    setFilterTransactionMin('');
  };

  const handleCopy = async (record: CustomerRecord, template: TemplateDefinition) => {
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

  const handleOpenDM = async (record: CustomerRecord, url: string, template: TemplateDefinition) => {
    // テンプレートメッセージを先にコピー（ブラウザのセキュリティ制限のため）
    const message = generateMessage(record, template, settings);
    try {
      await copyToClipboard(message);
      setPreview({ message, title: template.title });
      setCopiedId(`${record.customerName}-${template.id}`);
      window.setTimeout(() => setCopiedId(''), 1500);
    } catch (error) {
      console.error('コピーに失敗しました', error);
      window.alert('クリップボードへのコピーに失敗しました。');
    }
    
    // DMを開く
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const [showFiltersPanel, setShowFiltersPanel] = useState(false);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[2000px] flex-col gap-6 px-6 py-10 lg:px-12">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-3">
        <p className="text-sm uppercase tracking-[0.4em] text-sky-300">
          Customer Relationship
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          顧客管理ダッシュボード
        </h1>
        <p className="text-sm text-slate-300">
          顧客ごとの状況を把握し、最適なメッセージをワンクリックでコピーできます。
        </p>
        </div>
        
        {/* アクション定義ヘルプボタン */}
        <div className="relative group">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full bg-slate-800/60 hover:bg-slate-700 p-2 transition"
            title="アクション定義"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="h-5 w-5 fill-none stroke-slate-300"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </button>
          
          {/* ホバー時に表示されるツールチップ */}
          <div className="absolute right-0 top-full mt-2 w-96 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none group-hover:pointer-events-auto">
            <div className="bg-slate-900 rounded-xl border border-slate-700 shadow-2xl p-4 max-h-96 overflow-y-auto">
              <h3 className="text-sm font-semibold text-white mb-3">アクション定義</h3>
              <div className="space-y-3">
                {ACTION_DEFINITIONS.map((action) => (
                  <div key={action.name} className="border-b border-slate-700 pb-3 last:border-b-0 last:pb-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-white">
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
                    <p className="text-xs leading-relaxed text-slate-400">
                      {action.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur-lg rounded-2xl border border-slate-800 p-5 shadow-lg shadow-slate-950/40">
        <div className="flex items-center gap-4">
          <FilterInput
            label="検索"
            placeholder="顧客名・メモなど"
            value={searchTerm}
            onChange={setSearchTerm}
            className="flex-1"
          />
          <div className="flex items-end gap-2">
            <FilterSelect
              label="次のアクション"
              value={actionFilter}
              onChange={setActionFilter}
            />
          <button
            type="button"
              onClick={() => setShowFiltersPanel(true)}
              className="h-11 rounded-xl border border-slate-700 bg-slate-900 px-4 text-sm font-medium text-slate-200 transition hover:bg-slate-800 flex items-center gap-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                className="h-4 w-4 fill-none stroke-current"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              フィルター
              {(filterFavorite !== null || filterTrouble !== null || filterGender || filterAge || filterTransactionMin) && (
                <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-xs font-bold rounded-full bg-emerald-500 text-white">
                  {[filterFavorite !== null, filterTrouble !== null, filterGender, filterAge, filterTransactionMin].filter(Boolean).length}
                </span>
              )}
          </button>
        </div>
        </div>
        
        <div className="mt-3 flex items-center justify-between">
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

      {/* フィルターオーバーレイモーダル */}
      {showFiltersPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowFiltersPanel(false)}>
          <div className="bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">詳細フィルター</h2>
                <p className="text-xs text-slate-400 mt-1">条件を指定して顧客を絞り込む</p>
              </div>
        <button
          type="button"
                onClick={() => setShowFiltersPanel(false)}
                className="rounded-full p-2 hover:bg-slate-800 transition"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="h-5 w-5 fill-none stroke-slate-300"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
          </div>
            
            <div className="p-6 space-y-6">
              {/* マークフィルター */}
              <div>
                <h3 className="text-sm font-semibold text-slate-200 mb-3">マーク</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFilterFavorite(filterFavorite === true ? null : true)}
                    className={`flex items-center gap-2 px-4 py-3 rounded-lg border transition ${
                      filterFavorite === true
                        ? 'border-yellow-500 bg-yellow-500/20 text-yellow-300'
                        : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
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
                    <span className="text-sm font-medium">お気に入りのみ</span>
        </button>
                  
                  <button
                    type="button"
                    onClick={() => setFilterTrouble(filterTrouble === true ? null : true)}
                    className={`flex items-center gap-2 px-4 py-3 rounded-lg border transition ${
                      filterTrouble === true
                        ? 'border-orange-500 bg-orange-500/20 text-orange-300'
                        : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
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
                    <span className="text-sm font-medium">トラブルあり</span>
                  </button>
                </div>
              </div>

              {/* 性別フィルター */}
              <div>
                <h3 className="text-sm font-semibold text-slate-200 mb-3">性別</h3>
                <select
                  value={filterGender}
                  onChange={(e) => setFilterGender(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  <option value="">すべて</option>
                  {GENDER_OPTIONS.filter(Boolean).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              {/* 年齢フィルター */}
              <div>
                <h3 className="text-sm font-semibold text-slate-200 mb-3">年齢</h3>
                <select
                  value={filterAge}
                  onChange={(e) => setFilterAge(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  <option value="">すべて</option>
                  {AGE_OPTIONS.filter(Boolean).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              {/* 取引回数フィルター */}
              <div>
                <h3 className="text-sm font-semibold text-slate-200 mb-3">取引回数</h3>
                    <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={filterTransactionMin}
                    onChange={(e) => setFilterTransactionMin(e.target.value)}
                    placeholder="最小回数"
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  />
                  <span className="text-sm text-slate-400">回以上</span>
          </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700 p-5 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={clearFilters}
                className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-slate-700"
              >
                すべてクリア
        </button>
              <button
                type="button"
                onClick={() => setShowFiltersPanel(false)}
                className="flex-1 rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400"
              >
                適用
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="総顧客数" value={`${stats.totalCustomers} 名`} />
        <StatCard
          label="総売上"
          value={`¥${stats.totalAmount.toLocaleString()}`}
          accent
        />
        <StatCard label="要対応顧客" value={`${stats.urgentCount} 名`} />
        <StatCard 
          label="今月の新規顧客" 
          value={`${stats.newCustomersThisMonth} 名`}
          highlight
        />
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 shadow-xl shadow-slate-950/40">
        <div className="flex items-center justify-end px-4 pt-3 text-xs text-slate-500">
          横スクロールで詳細項目をご確認いただけます。
        </div>
        <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
          <table className="w-full border-collapse text-sm text-slate-100" style={{ minWidth: '1800px' }}>
            <thead className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur-sm text-left text-xs uppercase tracking-wider text-slate-300">
              <tr>
                {COLUMN_HEADERS.map((header, index) => {
                  const isMarkColumn = index >= 0 && index < 2; // isFavorite, hasTrouble の列（SVGアイコン表示）
                  const isFixedColumn = index < 5; // 固定列（星、バツ、顧客名、次のアクション、連絡先）
                  
                  // 各列の幅を定義
                  const getColumnWidth = () => {
                    if (index === 0 || index === 1) return '60px'; // 星、バツ
                    if (index === 2) return '200px'; // 顧客名
                    if (index === 3) return '180px'; // 次のアクション
                    if (index === 4) return '80px'; // 連絡先（アイコンのみ）
                    if (index === 5 || index === 6) return '140px'; // 日付列
                    if (index === 7) return '120px'; // 取引回数（幅を増やした）
                    if (index === 8) return '140px'; // 総額
                    if (index === 9 || index === 10) return '120px'; // 性別、年齢
                    if (index === 11) return '300px'; // 関係性/メモ
                    return 'auto';
                  };
                  
                  const getLeftPosition = () => {
                    if (index === 0) return '0px';      // 星
                    if (index === 1) return '60px';     // バツ
                    if (index === 2) return '120px';    // 顧客名
                    if (index === 3) return '320px';    // 次のアクション
                    if (index === 4) return '500px';    // 連絡先
                    return '0px';
                  };
                  
                  return (
                    <th
                      key={header}
                      className={`whitespace-nowrap border-b border-slate-800 px-4 py-3 font-semibold ${
                        isMarkColumn ? 'text-center' : ''
                      } ${
                        isFixedColumn
                          ? 'sticky z-30 bg-slate-900/95 shadow-[2px_0_4px_rgba(0,0,0,0.3)]'
                          : ''
                      }`}
                      style={{
                        width: getColumnWidth(),
                        minWidth: getColumnWidth(),
                        maxWidth: getColumnWidth(),
                        ...(isFixedColumn ? { left: getLeftPosition() } : {}),
                      }}
                    >
                      {isMarkColumn ? (
                        <button
                          type="button"
                          onClick={() => handleSort(index)}
                          className="flex items-center justify-center gap-2 mx-auto"
                        >
                          {index === 0 ? (
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
                          ) : (
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
                <th 
                  className="sticky right-0 z-30 whitespace-nowrap border-b border-slate-800 bg-slate-900/95 px-4 py-3 font-semibold shadow-[-2px_0_4px_rgba(0,0,0,0.3)]"
                  style={{ width: '140px', minWidth: '140px', maxWidth: '140px' }}
                >
                  テンプレート
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRecords.map((record) => {
                const recordIndex = findRecordIndex(record, customerList);
                const templates2 = selectTemplates(record, templates);

                return (
                  <tr
                    key={`${record.customerName || '未設定'}-${record.nextAction || '未設定'}-${record.scheduledDate || ''}-${recordIndex}`}
                    className="border-b border-slate-800/60 bg-slate-900/40 transition hover:bg-slate-800/40"
                  >
                    {COLUMN_KEYS.map((key, index) => {
                      const isFixedColumn = index < 5; // 星、バツ、顧客名、次のアクション、連絡先
                      const cellClass = getCellClass(key);
                      
                      // 各列の幅を定義（ヘッダーと同じ）
                      const getColumnWidth = () => {
                        if (index === 0 || index === 1) return '60px'; // 星、バツ
                        if (index === 2) return '200px'; // 顧客名
                        if (index === 3) return '180px'; // 次のアクション
                        if (index === 4) return '80px'; // 連絡先（アイコンのみ）
                        if (index === 5 || index === 6) return '140px'; // 日付列
                        if (index === 7) return '120px'; // 取引回数（幅を増やした）
                        if (index === 8) return '140px'; // 総額
                        if (index === 9 || index === 10) return '120px'; // 性別、年齢
                        if (index === 11) return '300px'; // 関係性/メモ
                        return 'auto';
                      };
                      
                      const getLeftPosition = () => {
                        if (index === 0) return '0px';      // 星
                        if (index === 1) return '60px';     // バツ
                        if (index === 2) return '120px';    // 顧客名
                        if (index === 3) return '320px';    // 次のアクション
                        if (index === 4) return '500px';    // 連絡先
                        return '0px';
                      };
                      
                      return (
                        <td
                          key={key}
                          className={`${cellClass} ${
                            isFixedColumn
                              ? 'sticky z-10 bg-slate-900/95 shadow-[2px_0_4px_rgba(0,0,0,0.3)]'
                              : ''
                          }`}
                          style={{
                            width: getColumnWidth(),
                            minWidth: getColumnWidth(),
                            maxWidth: getColumnWidth(),
                            ...(isFixedColumn ? { left: getLeftPosition() } : {}),
                          }}
                        >
                          {renderEditableField(record, recordIndex, key, handleCellChange, handleMarkToggle, (rec, url) => {
                            // DMを開く時は最初にformalテンプレートを使用
                            const template = templates2.formal || templates2.casual;
                            if (template) {
                              handleOpenDM(rec, url, template);
                            }
                          })}
                        </td>
                      );
                    })}
                    <td 
                      className="sticky right-0 z-10 bg-slate-900/95 px-4 py-3 text-slate-200 shadow-[-2px_0_4px_rgba(0,0,0,0.3)]"
                      style={{ width: '140px', minWidth: '140px', maxWidth: '140px' }}
                    >
                      <div className="flex flex-row gap-2 items-center justify-center">
                        {templates2.formal && (
                          <button
                            type="button"
                            onClick={() => handleCopy(record, templates2.formal!)}
                            className="inline-flex items-center justify-center rounded-full bg-sky-500 p-2 transition hover:bg-sky-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:opacity-60"
                            disabled={isSaving}
                            title="資料版をコピー"
                          >
                            {copiedId === `${record.customerName}-${templates2.formal.id}` ? (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                className="h-5 w-5 fill-none stroke-white"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            ) : (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                className="h-5 w-5 fill-none stroke-white"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="16" y1="13" x2="8" y2="13" />
                                <line x1="16" y1="17" x2="8" y2="17" />
                                <polyline points="10 9 9 9 8 9" />
                              </svg>
                            )}
                          </button>
                        )}
                        {templates2.casual && (
                          <button
                            type="button"
                            onClick={() => handleCopy(record, templates2.casual!)}
                            className="inline-flex items-center justify-center rounded-full bg-emerald-500 p-2 transition hover:bg-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:opacity-60"
                            disabled={isSaving}
                            title="カジュアル版をコピー"
                          >
                            {copiedId === `${record.customerName}-${templates2.casual.id}` ? (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                className="h-5 w-5 fill-none stroke-emerald-950"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            ) : (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                className="h-5 w-5 fill-none stroke-emerald-950"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                              </svg>
                            )}
                          </button>
                        )}
                        {!templates2.formal && !templates2.casual && (
                          <span className="text-xs text-slate-500">-</span>
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
    case 0:
      return record.isFavorite ? '1' : '0';
    case 1:
      return record.hasTrouble ? '1' : '0';
    case 7:
      return parseInt(record.transactionCount, 10) || 0;
    case 8:
      return parseAmount(record.totalAmount);
    case 5:
    case 6:
      return recordValueToDate(record, columnIndex).getTime();
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
  variant?: 'formal' | 'casual',
): TemplateDefinition | null {
  const action = getActionKeyword(record.nextAction);
  const candidates = templates.filter((template) =>
    template.actions?.some((candidate) => action.includes(candidate)),
  );

  if (candidates.length === 0) {
    return null;
  }

  const existing = isExistingCustomer(record);

  // variantが指定されている場合は、そのvariantのテンプレートを優先
  if (variant) {
    const variantCandidates = candidates.filter((template) => template.variant === variant);
    
    for (const template of variantCandidates) {
      if (!template.condition) {
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(template.condition, 'existing')) {
        if (template.condition.existing === existing) {
          return template;
        }
      }
    }

    const noCondition = variantCandidates.find((candidate) => !candidate.condition);
    if (noCondition) return noCondition;
    if (variantCandidates.length > 0) return variantCandidates[0];
  }

  // variantが指定されていない場合は従来の動作
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

function selectTemplates(
  record: CustomerRecord,
  templates: TemplateDefinition[],
): { formal: TemplateDefinition | null; casual: TemplateDefinition | null } {
  return {
    formal: selectTemplate(record, templates, 'formal'),
    casual: selectTemplate(record, templates, 'casual'),
  };
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
  onOpenDM?: (record: CustomerRecord, url: string) => void,
): ReactNode {
  const rawValue = record[key];
  const value = typeof rawValue === 'boolean' ? '' : (rawValue ?? '');

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
      <input
        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        value={value}
        onChange={(event) => onChange(recordIndex, key, event.target.value)}
        type="text"
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
      <button
        type="button"
        onClick={() => {
          if (onOpenDM) {
            onOpenDM(record, url);
          }
        }}
        className="mx-auto inline-flex items-center justify-center rounded-full bg-sky-500 p-2 transition hover:bg-sky-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
        title="DMを開く"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className="h-5 w-5 fill-none stroke-white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </button>
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

  // リストに入っている = 既にコンタクト済みなので、「はじめまして」は使わない
  // 取引回数2以上で120日未満の場合のみ、特別な挨拶を使用
  if (Number.isFinite(count) && count >= 2 && diffDays !== null && diffDays < 120) {
    // 頻繁にやり取りがある顧客向け
    prefix = diffDays < 30 ? 'いつもありがとうございます' : 'いつもお世話になっております';
  } else {
    // 時間経過に応じた挨拶文
    if (diffDays === null) {
      // 最終連絡日が不明な場合
      prefix = count >= 2 ? 'いつもお世話になっております' : '以前はありがとうございました';
    } else if (diffDays <= 7) {
      // 0-7日: 最近連絡した
      prefix = '先日はありがとうございました';
    } else if (diffDays <= 30) {
      // 8-30日: 1ヶ月以内
      prefix = 'この度はありがとうございました';
    } else if (diffDays <= 90) {
      // 31-90日: 3ヶ月以内
      prefix = '以前はありがとうございました';
    } else if (diffDays <= 180) {
      // 91-180日: 半年以内
      prefix = 'ご無沙汰しております';
    } else if (diffDays <= 365) {
      // 181-365日: 1年以内
      prefix = 'お久しぶりです';
    } else {
      // 366日以上: 1年以上
      prefix = '大変ご無沙汰しております';
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

function buildSignature(
  companyName: string,
  personDisplay: string,
  materialUrl: string,
  contactUrl?: string,
): string {
  // 署名は不要のため、空文字列を返す
  return '';
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
  const contact = parseContact(record.contactUrl);
  const signature = buildSignature(
    defaults.companyName,
    personDisplay,
    defaults.materialUrl,
    contact?.url || record.contactUrl,
  );

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
  highlight?: boolean;
}

function StatCard({ label, value, accent = false, highlight = false }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-inner shadow-black/30">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{label}</p>
      <p
        className={`mt-3 text-2xl font-semibold ${
          accent ? 'text-emerald-300' : highlight ? 'text-sky-300' : 'text-white'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

