import { getDatabase } from './db';
import { CounterpartyRule } from '../types/database';
import { normalizeVietnameseText } from '../services/autoCategorizer';

export class CounterpartyRepository {
  /**
   * Look up category assigned to this counterparty name in the past
   */
  async findCategoryByCounterparty(rawName: string): Promise<number | null> {
    if (!rawName || rawName.trim().length === 0) return null;
    const normalized = normalizeVietnameseText(rawName);
    const db = await getDatabase();

    const row = await db.getFirstAsync<CounterpartyRule>(
      'SELECT * FROM counterparty_rules WHERE counterparty_name = ?',
      [normalized]
    );

    return row ? row.category_id : null;
  }

  /**
   * Save or update memory rule: [Counterparty Name] -> [Category ID]
   */
  async rememberCounterparty(rawName: string, categoryId: number): Promise<void> {
    if (!rawName || rawName.trim().length === 0) return;
    const normalized = normalizeVietnameseText(rawName);
    const db = await getDatabase();

    await db.runAsync(
      `INSERT INTO counterparty_rules (counterparty_name, category_id, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(counterparty_name) DO UPDATE SET category_id = excluded.category_id, updated_at = CURRENT_TIMESTAMP`,
      [normalized, categoryId]
    );
  }

  async getAll(): Promise<CounterpartyRule[]> {
    const db = await getDatabase();
    return await db.getAllAsync<CounterpartyRule>('SELECT * FROM counterparty_rules ORDER BY updated_at DESC');
  }
}

export const counterpartyRepo = new CounterpartyRepository();
