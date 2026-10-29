import { getDatabase } from './db';
import {
  Transaction,
  CreateTransactionDTO,
  CategorySummary,
} from '../types/database';

export interface TransactionFilter {
  categoryId?: number;
  startDate?: string;
  endDate?: string;
  search?: string;
  isReviewed?: number;
  limit?: number;
  offset?: number;
}

export class TransactionRepository {
  /**
   * Check if a transaction ID (Gmail message_id) already exists in SQLite local
   */
  async exists(id: string): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<{ count: number }>(
      'SELECT count(*) as count FROM transactions WHERE id = ?',
      [id]
    );
    return (result?.count ?? 0) > 0;
  }

  /**
   * Check multiple IDs in a batch to minimize queries
   */
  async getExistingIds(ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const db = await getDatabase();
    const placeholders = ids.map(() => '?').join(',');
    const rows = await db.getAllAsync<{ id: string }>(
      `SELECT id FROM transactions WHERE id IN (${placeholders})`,
      ids
    );
    return new Set(rows.map((r) => r.id));
  }

  /**
   * Insert a new transaction
   */
  async insert(dto: CreateTransactionDTO): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO transactions (id, amount, transaction_time, description, category_id, is_reviewed, raw_payload)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        dto.id,
        dto.amount,
        dto.transaction_time,
        dto.description,
        dto.category_id ?? null,
        dto.is_reviewed ?? 0,
        dto.raw_payload ?? null,
      ]
    );
  }

  /**
   * Get transaction by ID including joined category details
   */
  async getById(id: string): Promise<Transaction | null> {
    const db = await getDatabase();
    const query = `
      SELECT t.*, c.name as category_name, c.icon as category_icon, c.is_essential
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.id = ?
    `;
    const row = await db.getFirstAsync<Transaction>(query, [id]);
    return row || null;
  }

  /**
   * Get filtered transactions with pagination
   */
  async getTransactions(filter: TransactionFilter = {}): Promise<Transaction[]> {
    const db = await getDatabase();
    const conditions: string[] = [];
    const params: any[] = [];

    if (filter.categoryId !== undefined) {
      conditions.push('t.category_id = ?');
      params.push(filter.categoryId);
    }

    if (filter.startDate) {
      conditions.push('t.transaction_time >= ?');
      params.push(filter.startDate);
    }

    if (filter.endDate) {
      conditions.push('t.transaction_time <= ?');
      params.push(filter.endDate);
    }

    if (filter.search && filter.search.trim().length > 0) {
      conditions.push('t.description LIKE ?');
      params.push(`%${filter.search.trim()}%`);
    }

    if (filter.isReviewed !== undefined) {
      conditions.push('t.is_reviewed = ?');
      params.push(filter.isReviewed);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;

    const query = `
      SELECT t.*, c.name as category_name, c.icon as category_icon, c.is_essential
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      ${whereClause}
      ORDER BY t.transaction_time DESC, t.created_at DESC
      LIMIT ? OFFSET ?
    `;

    params.push(limit, offset);
    return await db.getAllAsync<Transaction>(query, params);
  }

  /**
   * Get total spending and count
   */
  async getTotalSpending(startDate?: string, endDate?: string): Promise<{
    total: number;
    expenseTotal: number;
    incomeTotal: number;
    essentialTotal: number;
    discretionaryTotal: number;
    count: number;
  }> {
    const db = await getDatabase();
    const conditions: string[] = [];
    const params: any[] = [];

    if (startDate) {
      conditions.push('t.transaction_time >= ?');
      params.push(startDate);
    }
    if (endDate) {
      conditions.push('t.transaction_time <= ?');
      params.push(endDate);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
      SELECT
        SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END) as expense_total,
        SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END) as income_total,
        SUM(CASE WHEN t.amount < 0 AND c.is_essential = 1 THEN ABS(t.amount) ELSE 0 END) as essential_total,
        SUM(CASE WHEN t.amount < 0 AND c.is_essential = 0 THEN ABS(t.amount) ELSE 0 END) as discretionary_total,
        COUNT(t.id) as count
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      ${where}
    `;

    const row = await db.getFirstAsync<{
      expense_total: number | null;
      income_total: number | null;
      essential_total: number | null;
      discretionary_total: number | null;
      count: number;
    }>(query, params);

    const expenseTotal = row?.expense_total ?? 0;
    const incomeTotal = row?.income_total ?? 0;

    return {
      total: expenseTotal,
      expenseTotal,
      incomeTotal,
      essentialTotal: row?.essential_total ?? 0,
      discretionaryTotal: row?.discretionary_total ?? 0,
      count: row?.count ?? 0,
    };
  }

  /**
   * Get spending breakdown by category for analytics
   */
  async getCategorySummary(startDate?: string, endDate?: string): Promise<CategorySummary[]> {
    const db = await getDatabase();
    const conditions: string[] = [];
    const params: any[] = [];

    if (startDate) {
      conditions.push('t.transaction_time >= ?');
      params.push(startDate);
    }
    if (endDate) {
      conditions.push('t.transaction_time <= ?');
      params.push(endDate);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT
        t.category_id,
        COALESCE(c.name, 'Chờ xác nhận') as name,
        COALESCE(c.icon, '❓') as icon,
        COALESCE(c.is_essential, 0) as is_essential,
        SUM(t.amount) as total_amount,
        COUNT(t.id) as count
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      ${where}
      GROUP BY t.category_id, c.name, c.icon, c.is_essential
      ORDER BY total_amount DESC
    `;

    const rows = await db.getAllAsync<CategorySummary>(query, params);
    const totalAll = rows.reduce((acc, curr) => acc + Math.abs(curr.total_amount || 0), 0);

    return rows.map((r) => ({
      ...r,
      total_amount: Math.abs(r.total_amount),
      percentage: totalAll > 0 ? Math.round((Math.abs(r.total_amount) / totalAll) * 100) : 0,
    }));
  }

  /**
   * Update category of a transaction (user manual recategorization)
   * Also sets is_reviewed = 1
   */
  async updateCategory(transactionId: string, categoryId: number | null): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE transactions SET category_id = ?, is_reviewed = 1 WHERE id = ?',
      [categoryId, transactionId]
    );
  }

  /**
   * Delete transaction by ID
   */
  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
  }

  /**
   * Clear all transactions
   */
  async clearAll(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM transactions');
  }
}

export const transactionRepo = new TransactionRepository();
