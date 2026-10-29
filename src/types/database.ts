export interface UserProfile {
  id: number;
  monthly_budget: number;
  occupation_type: 'student' | 'working';
  savings_target: number;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  icon: string | null;
  budget_limit: number;
  is_essential: number; // 1: Thiết yếu, 0: Phát sinh/Giải trí
}

export interface CategoryKeyword {
  keyword_id: number;
  category_id: number;
  keyword: string;
  priority: number;
}

export interface CounterpartyRule {
  id: number;
  counterparty_name: string;
  category_id: number;
  updated_at: string;
}

export interface Transaction {
  id: string; // Gmail Message ID or manual UUID
  amount: number; // Negative: Expense, Positive: Income
  transaction_time: string; // DATETIME
  description: string;
  category_id: number | null;
  is_reviewed: number; // 0: Máy tự đoán, 1: Người dùng đã xác nhận/sửa lại
  raw_payload: string | null;
  created_at: string;
  // Joined fields
  category_name?: string | null;
  category_icon?: string | null;
  is_essential?: number | null;
  counterparty?: string | null;
}

export interface CreateTransactionDTO {
  id: string;
  amount: number;
  transaction_time: string;
  description: string;
  category_id?: number | null;
  is_reviewed?: number;
  raw_payload?: string | null;
}

export interface CategorySummary {
  category_id: number | null;
  name: string;
  icon: string;
  is_essential: number;
  total_amount: number;
  count: number;
  percentage?: number;
}
