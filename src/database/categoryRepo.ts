import { getDatabase } from './db';
import { Category, CategoryKeyword } from '../types/database';

export class CategoryRepository {
  /**
   * Get all expense categories
   */
  async getAll(): Promise<Category[]> {
    const db = await getDatabase();
    return await db.getAllAsync<Category>('SELECT * FROM categories ORDER BY id ASC');
  }

  /**
   * Get category by ID
   */
  async getById(id: number): Promise<Category | null> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<Category>(
      'SELECT * FROM categories WHERE id = ?',
      [id]
    );
    return result || null;
  }

  /**
   * Get all keywords, optionally filtered by category
   */
  async getKeywords(categoryId?: number): Promise<CategoryKeyword[]> {
    const db = await getDatabase();
    if (categoryId !== undefined) {
      return await db.getAllAsync<CategoryKeyword>(
        'SELECT * FROM category_keywords WHERE category_id = ? ORDER BY priority DESC, keyword_id ASC',
        [categoryId]
      );
    }
    return await db.getAllAsync<CategoryKeyword>(
      'SELECT * FROM category_keywords ORDER BY priority DESC, keyword_id ASC'
    );
  }

  /**
   * Add a new keyword rule (prevents duplicate keywords for the same category)
   */
  async addKeyword(categoryId: number, keyword: string, priority: number = 1): Promise<number> {
    const cleanKw = keyword.trim().toLowerCase();
    const db = await getDatabase();

    const existing = await db.getFirstAsync<CategoryKeyword>(
      'SELECT * FROM category_keywords WHERE category_id = ? AND keyword = ?',
      [categoryId, cleanKw]
    );

    if (existing) {
      if (priority > existing.priority) {
        await db.runAsync(
          'UPDATE category_keywords SET priority = ? WHERE keyword_id = ?',
          [priority, existing.keyword_id]
        );
      }
      return existing.keyword_id;
    }

    const res = await db.runAsync(
      'INSERT INTO category_keywords (category_id, keyword, priority) VALUES (?, ?, ?)',
      [categoryId, cleanKw, priority]
    );
    return res.lastInsertRowId;
  }

  /**
   * Delete a keyword rule
   */
  async deleteKeyword(keywordId: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM category_keywords WHERE keyword_id = ?', [keywordId]);
  }

  /**
   * Update category details (name, icon, budget_limit, is_essential)
   */
  async update(id: number, name: string, icon: string, budget_limit: number, is_essential: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE categories SET name = ?, icon = ?, budget_limit = ?, is_essential = ? WHERE id = ?',
      [name.trim(), icon.trim(), budget_limit, is_essential, id]
    );
  }

  /**
   * Create a new category
   */
  async create(name: string, icon: string, budget_limit: number = 0, is_essential: number = 1): Promise<number> {
    const db = await getDatabase();
    const res = await db.runAsync(
      'INSERT INTO categories (name, icon, budget_limit, is_essential) VALUES (?, ?, ?, ?)',
      [name.trim(), icon.trim(), budget_limit, is_essential]
    );
    return res.lastInsertRowId;
  }

  /**
   * Delete category
   */
  async delete(id: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM categories WHERE id = ?', [id]);
  }
}

export const categoryRepo = new CategoryRepository();
