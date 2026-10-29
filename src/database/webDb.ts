import AsyncStorage from '@react-native-async-storage/async-storage';
import { Category, Transaction, UserProfile, CategoryKeyword, CounterpartyRule } from '../types/database';
import { DEFAULT_CATEGORIES, DEFAULT_KEYWORDS, DEFAULT_USER_PROFILE } from './schema';

const STORAGE_KEY_PROFILE = '@expense_profile_web';
const STORAGE_KEY_CATEGORIES = '@expense_categories_web';
const STORAGE_KEY_KEYWORDS = '@expense_keywords_web';
const STORAGE_KEY_COUNTERPARTY = '@expense_counterparty_web';
const STORAGE_KEY_TRANSACTIONS = '@expense_transactions_web';

export class WebDatabase {
  private profile: UserProfile = {
    id: 1,
    monthly_budget: DEFAULT_USER_PROFILE.monthly_budget,
    occupation_type: DEFAULT_USER_PROFILE.occupation_type as any,
    savings_target: DEFAULT_USER_PROFILE.savings_target,
    updated_at: new Date().toISOString(),
  };
  private categories: Category[] = [];
  private keywords: CategoryKeyword[] = [];
  private counterpartyRules: CounterpartyRule[] = [];
  private transactions: Transaction[] = [];
  private loaded: boolean = false;

  private async ensureLoaded() {
    if (this.loaded) return;
    try {
      if (typeof window !== 'undefined') {
        const [profStr, catsStr, kwStr, cpStr, txStr] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_PROFILE),
          AsyncStorage.getItem(STORAGE_KEY_CATEGORIES),
          AsyncStorage.getItem(STORAGE_KEY_KEYWORDS),
          AsyncStorage.getItem(STORAGE_KEY_COUNTERPARTY),
          AsyncStorage.getItem(STORAGE_KEY_TRANSACTIONS),
        ]);

        if (profStr) this.profile = JSON.parse(profStr);
        if (catsStr) this.categories = JSON.parse(catsStr);
        if (kwStr) this.keywords = JSON.parse(kwStr);
        if (cpStr) this.counterpartyRules = JSON.parse(cpStr);
        if (txStr) this.transactions = JSON.parse(txStr);
      }
    } catch (e) {
      console.warn('Failed to load WebDatabase from AsyncStorage:', e);
    }

    if (this.categories.length === 0) {
      this.categories = DEFAULT_CATEGORIES.map((c) => ({ ...c }));
    }
    if (this.keywords.length === 0) {
      this.keywords = DEFAULT_KEYWORDS.map((k, idx) => ({
        keyword_id: idx + 1,
        category_id: k.category_id,
        keyword: k.keyword,
        priority: k.priority,
      }));
    }

    this.loaded = true;
  }

  private async persistCategories() {
    if (typeof window !== 'undefined') {
      try {
        await AsyncStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(this.categories));
      } catch (e) {}
    }
  }

  private async persistKeywords() {
    if (typeof window !== 'undefined') {
      try {
        await AsyncStorage.setItem(STORAGE_KEY_KEYWORDS, JSON.stringify(this.keywords));
      } catch (e) {}
    }
  }

  private async persistCounterparty() {
    if (typeof window !== 'undefined') {
      try {
        await AsyncStorage.setItem(STORAGE_KEY_COUNTERPARTY, JSON.stringify(this.counterpartyRules));
      } catch (e) {}
    }
  }

  private async persistTransactions() {
    if (typeof window !== 'undefined') {
      try {
        await AsyncStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(this.transactions));
      } catch (e) {}
    }
  }

  private async persistProfile() {
    if (typeof window !== 'undefined') {
      try {
        await AsyncStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(this.profile));
      } catch (e) {}
    }
  }

  async execAsync(sql: string): Promise<void> {
    await this.ensureLoaded();
    if (sql.includes('DROP TABLE')) {
      this.transactions = [];
      this.counterpartyRules = [];
      this.categories = DEFAULT_CATEGORIES.map((c) => ({ ...c }));
      this.keywords = DEFAULT_KEYWORDS.map((k, idx) => ({
        keyword_id: idx + 1,
        category_id: k.category_id,
        keyword: k.keyword,
        priority: k.priority,
      }));
      await Promise.all([
        this.persistTransactions(),
        this.persistCounterparty(),
        this.persistCategories(),
        this.persistKeywords(),
      ]);
    }
  }

  async runAsync(sql: string, params: any[] = []): Promise<{ lastInsertRowId: number; changes: number }> {
    await this.ensureLoaded();
    const cleanSql = sql.trim();

    // user_profile
    if (/INSERT.*user_profile/i.test(cleanSql)) {
      this.profile = {
        id: 1,
        monthly_budget: Number(params[0] ?? DEFAULT_USER_PROFILE.monthly_budget),
        occupation_type: (params[1] ?? DEFAULT_USER_PROFILE.occupation_type) as any,
        savings_target: Number(params[2] ?? DEFAULT_USER_PROFILE.savings_target),
        updated_at: new Date().toISOString(),
      };
      await this.persistProfile();
      return { lastInsertRowId: 1, changes: 1 };
    }

    // category_keywords
    if (/INSERT INTO category_keywords/i.test(cleanSql)) {
      const nextId = this.keywords.length > 0 ? Math.max(...this.keywords.map((k) => k.keyword_id)) + 1 : 1;
      this.keywords.push({
        keyword_id: nextId,
        category_id: Number(params[0]),
        keyword: String(params[1]),
        priority: Number(params[2] ?? 1),
      });
      await this.persistKeywords();
      return { lastInsertRowId: nextId, changes: 1 };
    }

    if (/DELETE FROM category_keywords WHERE keyword_id = \?/i.test(cleanSql)) {
      const id = params[0];
      this.keywords = this.keywords.filter((k) => k.keyword_id !== id);
      await this.persistKeywords();
      return { lastInsertRowId: 0, changes: 1 };
    }

    // counterparty_rules
    if (/INSERT INTO counterparty_rules/i.test(cleanSql)) {
      const name = String(params[0]);
      const catId = Number(params[1]);
      const idx = this.counterpartyRules.findIndex((c) => c.counterparty_name === name);
      if (idx !== -1) {
        this.counterpartyRules[idx].category_id = catId;
        this.counterpartyRules[idx].updated_at = new Date().toISOString();
      } else {
        const nextId = this.counterpartyRules.length > 0 ? Math.max(...this.counterpartyRules.map((c) => c.id)) + 1 : 1;
        this.counterpartyRules.push({
          id: nextId,
          counterparty_name: name,
          category_id: catId,
          updated_at: new Date().toISOString(),
        });
      }
      await this.persistCounterparty();
      return { lastInsertRowId: 1, changes: 1 };
    }

    // categories
    if (/INSERT INTO categories/i.test(cleanSql)) {
      const id = params.length >= 5 ? Number(params[0]) : (this.categories.length > 0 ? Math.max(...this.categories.map((c) => c.id)) + 1 : 1);
      const nameIdx = params.length >= 5 ? 1 : 0;
      const iconIdx = params.length >= 5 ? 2 : 1;
      const budgetIdx = params.length >= 5 ? 3 : 2;
      const essentialIdx = params.length >= 5 ? 4 : 3;

      const newCat: Category = {
        id,
        name: params[nameIdx] || '',
        icon: params[iconIdx] || '🏷️',
        budget_limit: Number(params[budgetIdx] ?? 0),
        is_essential: Number(params[essentialIdx] ?? 1),
      };
      this.categories.push(newCat);
      await this.persistCategories();
      return { lastInsertRowId: id, changes: 1 };
    }

    // UPDATE categories
    if (/UPDATE categories/i.test(cleanSql)) {
      const name = params[0];
      const icon = params[1];
      const budget_limit = Number(params[2] ?? 0);
      const is_essential = Number(params[3] ?? 1);
      const id = params[4];
      const idx = this.categories.findIndex((c) => c.id === id);
      if (idx !== -1) {
        this.categories[idx] = { ...this.categories[idx], name, icon, budget_limit, is_essential };
        await this.persistCategories();
        return { lastInsertRowId: id, changes: 1 };
      }
      return { lastInsertRowId: 0, changes: 0 };
    }

    // INSERT INTO transactions
    if (/INSERT INTO transactions/i.test(cleanSql)) {
      const newTx: Transaction = {
        id: params[0],
        amount: Number(params[1]),
        transaction_time: params[2],
        description: params[3] || '',
        category_id: params[4] !== undefined && params[4] !== null ? Number(params[4]) : 8,
        is_reviewed: Number(params[5] ?? 0),
        raw_payload: params[6] || null,
        created_at: new Date().toISOString(),
      };
      const existIdx = this.transactions.findIndex((t) => t.id === newTx.id);
      if (existIdx !== -1) {
        this.transactions[existIdx] = newTx;
      } else {
        this.transactions.push(newTx);
      }
      await this.persistTransactions();
      return { lastInsertRowId: 1, changes: 1 };
    }

    // UPDATE transactions SET category_id = ?, is_reviewed = 1 WHERE id = ?
    if (/UPDATE transactions/i.test(cleanSql)) {
      const categoryId = params[0] !== null && params[0] !== undefined ? Number(params[0]) : null;
      const id = params[1];
      const idx = this.transactions.findIndex((t) => t.id === id);
      if (idx !== -1) {
        this.transactions[idx].category_id = categoryId;
        this.transactions[idx].is_reviewed = 1;
        await this.persistTransactions();
        return { lastInsertRowId: 0, changes: 1 };
      }
      return { lastInsertRowId: 0, changes: 0 };
    }

    // DELETE FROM transactions WHERE id = ?
    if (/DELETE FROM transactions WHERE id = \?/i.test(cleanSql)) {
      const id = params[0];
      this.transactions = this.transactions.filter((t) => t.id !== id);
      await this.persistTransactions();
      return { lastInsertRowId: 0, changes: 1 };
    }

    // DELETE FROM transactions
    if (/DELETE FROM transactions/i.test(cleanSql)) {
      this.transactions = [];
      await this.persistTransactions();
      return { lastInsertRowId: 0, changes: 1 };
    }

    return { lastInsertRowId: 0, changes: 0 };
  }

  async getAllAsync<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    await this.ensureLoaded();
    const cleanSql = sql.trim();

    if (/SELECT count\(\*\) as count FROM user_profile/i.test(cleanSql)) {
      return [{ count: 1 }] as any;
    }

    if (/SELECT count\(\*\) as count FROM categories/i.test(cleanSql)) {
      return [{ count: this.categories.length }] as any;
    }

    if (/SELECT \* FROM categories/i.test(cleanSql)) {
      return [...this.categories].sort((a, b) => a.id - b.id) as any;
    }

    if (/SELECT \* FROM category_keywords/i.test(cleanSql)) {
      if (cleanSql.includes('category_id = ?')) {
        const catId = params[0];
        return this.keywords.filter((k) => k.category_id === catId).sort((a, b) => b.priority - a.priority) as any;
      }
      return [...this.keywords].sort((a, b) => b.priority - a.priority) as any;
    }

    if (/SELECT \* FROM counterparty_rules/i.test(cleanSql)) {
      return [...this.counterpartyRules] as any;
    }

    if (/SELECT id FROM transactions WHERE id IN/i.test(cleanSql)) {
      const idSet = new Set(params);
      return this.transactions.filter((t) => idSet.has(t.id)).map((t) => ({ id: t.id })) as any;
    }

    // Category summary aggregation query
    if (/SELECT.*t\.category_id.*SUM\(t\.amount\)/is.test(cleanSql)) {
      let filtered = [...this.transactions];
      if (params.length > 0 && cleanSql.includes('t.transaction_time >=')) {
        filtered = filtered.filter((t) => t.transaction_time >= params[0]);
      }

      const map = new Map<number | null, { total_amount: number; count: number }>();
      for (const t of filtered) {
        const catId = t.category_id ?? 8;
        const current = map.get(catId) || { total_amount: 0, count: 0 };
        current.total_amount += Math.abs(t.amount);
        current.count += 1;
        map.set(catId, current);
      }

      const results: any[] = [];
      for (const [catId, data] of map.entries()) {
        const cat = this.categories.find((c) => c.id === catId);
        results.push({
          category_id: catId,
          name: cat ? cat.name : 'Chờ xác nhận',
          icon: cat ? cat.icon : '❓',
          is_essential: cat ? cat.is_essential : 0,
          total_amount: data.total_amount,
          count: data.count,
        });
      }

      results.sort((a, b) => b.total_amount - a.total_amount);
      return results as any;
    }

    // SELECT t.* FROM transactions
    if (/SELECT t\.\*.*FROM transactions t/is.test(cleanSql)) {
      let filtered = [...this.transactions];

      if (cleanSql.includes('t.category_id = ?')) {
        filtered = filtered.filter((t) => t.category_id === params[0]);
      }

      if (cleanSql.includes('t.is_reviewed = ?')) {
        filtered = filtered.filter((t) => t.is_reviewed === params[params.length - 3]);
      }

      if (cleanSql.includes('t.description LIKE ?')) {
        const searchParam = params.find((p) => typeof p === 'string' && p.startsWith('%') && p.endsWith('%'));
        if (searchParam) {
          const rawSearch = searchParam.replace(/%/g, '').toLowerCase();
          filtered = filtered.filter((t) => (t.description || '').toLowerCase().includes(rawSearch));
        }
      }

      filtered.sort((a, b) => new Date(b.transaction_time).getTime() - new Date(a.transaction_time).getTime());

      const limit = params[params.length - 2] ?? 50;
      const offset = params[params.length - 1] ?? 0;
      const sliced = filtered.slice(offset, offset + limit);

      return sliced.map((t) => {
        const cat = this.categories.find((c) => c.id === t.category_id);
        return {
          ...t,
          category_name: cat ? cat.name : 'Chờ xác nhận',
          category_icon: cat ? cat.icon : '❓',
          is_essential: cat ? cat.is_essential : 0,
        };
      }) as any;
    }

    return [] as any;
  }

  async getFirstAsync<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    await this.ensureLoaded();
    const cleanSql = sql.trim();

    if (/SELECT \* FROM user_profile/i.test(cleanSql)) {
      return this.profile as any;
    }

    if (/SELECT count\(\*\) as count FROM user_profile/i.test(cleanSql)) {
      return { count: 1 } as any;
    }

    if (/SELECT \* FROM counterparty_rules WHERE counterparty_name = \?/i.test(cleanSql)) {
      const name = params[0];
      const found = this.counterpartyRules.find((c) => c.counterparty_name === name);
      return (found as any) || null;
    }

    if (/SELECT count\(\*\) as count FROM transactions WHERE id = \?/i.test(cleanSql)) {
      const id = params[0];
      const count = this.transactions.filter((t) => t.id === id).length;
      return { count } as any;
    }

    if (/SELECT.*(?:expense_total|total).*FROM transactions/is.test(cleanSql)) {
      let filtered = [...this.transactions];
      if (cleanSql.includes('t.transaction_time >=')) {
        filtered = filtered.filter((t) => t.transaction_time >= params[0]);
      }
      let expenseTotal = 0;
      let incomeTotal = 0;
      let essentialTotal = 0;
      let discretionaryTotal = 0;
      for (const t of filtered) {
        if (t.amount < 0) {
          const absVal = Math.abs(t.amount);
          expenseTotal += absVal;
          const cat = this.categories.find((c) => c.id === t.category_id);
          if (cat?.is_essential === 1) {
            essentialTotal += absVal;
          } else {
            discretionaryTotal += absVal;
          }
        } else {
          incomeTotal += t.amount;
        }
      }
      return {
        total: expenseTotal,
        expense_total: expenseTotal,
        income_total: incomeTotal,
        essential_total: essentialTotal,
        discretionary_total: discretionaryTotal,
        count: filtered.length,
      } as any;
    }

    if (/WHERE t\.id = \?/i.test(cleanSql)) {
      const id = params[0];
      const t = this.transactions.find((tx) => tx.id === id);
      if (!t) return null;
      const cat = this.categories.find((c) => c.id === t.category_id);
      return {
        ...t,
        category_name: cat ? cat.name : 'Chờ xác nhận',
        category_icon: cat ? cat.icon : '❓',
        is_essential: cat ? cat.is_essential : 0,
      } as any;
    }

    const all = await this.getAllAsync<T>(sql, params);
    return all.length > 0 ? all[0] : null;
  }
}

export const webDatabase = new WebDatabase();
