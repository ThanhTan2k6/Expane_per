function isWebOrNodeTest(): boolean {
  if (typeof process !== 'undefined' && !!process.versions?.node && typeof (globalThis as any).nativeCallSyncHook === 'undefined') {
    return true;
  }
  try {
    const { Platform } = require('react-native');
    return Platform.OS === 'web';
  } catch {
    return true;
  }
}
import {
  CREATE_USER_PROFILE_TABLE,
  CREATE_CATEGORIES_TABLE,
  CREATE_CATEGORY_KEYWORDS_TABLE,
  CREATE_COUNTERPARTY_RULES_TABLE,
  CREATE_TRANSACTIONS_TABLE,
  CREATE_INDEXES,
  DEFAULT_USER_PROFILE,
  DEFAULT_CATEGORIES,
  DEFAULT_KEYWORDS,
} from './schema';
import { webDatabase } from './webDb';

export interface DatabaseAdapter {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: any[]): Promise<{ lastInsertRowId: number; changes: number }>;
  getAllAsync<T = any>(sql: string, params?: any[]): Promise<T[]>;
  getFirstAsync<T = any>(sql: string, params?: any[]): Promise<T | null>;
}

class NativeSQLiteAdapter implements DatabaseAdapter {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  async execAsync(sql: string): Promise<void> {
    await this.db.execAsync(sql);
  }

  async runAsync(sql: string, params: any[] = []): Promise<{ lastInsertRowId: number; changes: number }> {
    const res = await this.db.runAsync(sql, ...(params as any));
    return {
      lastInsertRowId: res.lastInsertRowId,
      changes: res.changes,
    };
  }

  async getAllAsync<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return (await this.db.getAllAsync(sql, ...(params as any))) as T[];
  }

  async getFirstAsync<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    return (await this.db.getFirstAsync(sql, ...(params as any))) as T | null;
  }
}

let dbInstance: DatabaseAdapter | null = null;

/**
 * Get or open the local database (Native SQLite on Mobile, Instant Web Database on Web)
 */
export async function getDatabase(): Promise<DatabaseAdapter> {
  if (dbInstance) {
    return dbInstance;
  }

  if (isWebOrNodeTest()) {
    dbInstance = webDatabase;
    return webDatabase;
  }

  try {
    const SQLite = require('expo-sqlite');
    const rawDb = await SQLite.openDatabaseAsync('expenses_local.db');
    dbInstance = new NativeSQLiteAdapter(rawDb);
    return dbInstance;
  } catch (err) {
    console.warn('Native SQLite failed to open, falling back to WebDatabase:', err);
    dbInstance = webDatabase;
    return webDatabase;
  }
}

/**
 * Initialize database schema and seed default student categories & keywords
 */
export async function initDatabase(): Promise<void> {
  const db = await getDatabase();

  // Execute table definitions
  await db.execAsync(`
    PRAGMA foreign_keys = ON;
    ${CREATE_USER_PROFILE_TABLE}
    ${CREATE_CATEGORIES_TABLE}
    ${CREATE_CATEGORY_KEYWORDS_TABLE}
    ${CREATE_COUNTERPARTY_RULES_TABLE}
    ${CREATE_TRANSACTIONS_TABLE}
    ${CREATE_INDEXES}
  `);

  // 1. Seed user_profile
  const profileRow = await db.getFirstAsync<{ count: number }>(
    'SELECT count(*) as count FROM user_profile'
  );
  if ((profileRow?.count ?? 0) === 0) {
    await db.runAsync(
      `INSERT INTO user_profile (id, monthly_budget, occupation_type, savings_target)
       VALUES (1, ?, ?, ?)`,
      [
        DEFAULT_USER_PROFILE.monthly_budget,
        DEFAULT_USER_PROFILE.occupation_type,
        DEFAULT_USER_PROFILE.savings_target,
      ]
    );
  }

  // 2. Seed categories & keywords
  const existingCategories = await db.getAllAsync<{ count: number }>(
    'SELECT count(*) as count FROM categories'
  );

  const count = existingCategories[0]?.count ?? 0;
  if (count === 0) {
    console.log('Seeding student categories and smart keywords...');
    for (const cat of DEFAULT_CATEGORIES) {
      await db.runAsync(
        'INSERT INTO categories (id, name, icon, budget_limit, is_essential) VALUES (?, ?, ?, ?, ?)',
        [cat.id, cat.name, cat.icon, cat.budget_limit, cat.is_essential]
      );
    }

    for (const kw of DEFAULT_KEYWORDS) {
      await db.runAsync(
        'INSERT INTO category_keywords (category_id, keyword, priority) VALUES (?, ?, ?)',
        [kw.category_id, kw.keyword, kw.priority]
      );
    }
  }
}

/**
 * Reset database
 */
export async function resetDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`
    DROP TABLE IF EXISTS transactions;
    DROP TABLE IF EXISTS counterparty_rules;
    DROP TABLE IF EXISTS category_keywords;
    DROP TABLE IF EXISTS categories;
    DROP TABLE IF EXISTS user_profile;
  `);
  await initDatabase();
}
