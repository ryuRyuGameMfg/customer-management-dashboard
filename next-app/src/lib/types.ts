export interface CustomerRecord {
  customerName: string;
  lastContactDate: string;
  nextAction: string;
  scheduledDate: string;
  contactUrl: string;
  transactionCount: string;
  totalAmount: string;
  gender: string;
  age: string;
  notes: string;
  hasHeart: boolean;
  hasTrouble: boolean;
  isFavorite: boolean;
}

export interface TemplateCondition {
  existing?: boolean;
  [key: string]: unknown;
}

export interface TemplateDefinition {
  id: string;
  actions: string[];
  title: string;
  variant?: 'formal' | 'casual';
  condition?: TemplateCondition;
  placeholders?: string[];
  template: string;
}

