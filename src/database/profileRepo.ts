import { getDatabase } from './db';
import { UserProfile } from '../types/database';
import { DEFAULT_USER_PROFILE } from './schema';

export class ProfileRepository {
  async getProfile(): Promise<UserProfile> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<UserProfile>('SELECT * FROM user_profile WHERE id = 1');
    if (row) return row;

    // Seed default if not yet created
    await db.runAsync(
      `INSERT OR REPLACE INTO user_profile (id, monthly_budget, occupation_type, savings_target)
       VALUES (1, ?, ?, ?)`,
      [
        DEFAULT_USER_PROFILE.monthly_budget,
        DEFAULT_USER_PROFILE.occupation_type,
        DEFAULT_USER_PROFILE.savings_target,
      ]
    );

    return {
      id: 1,
      monthly_budget: DEFAULT_USER_PROFILE.monthly_budget,
      occupation_type: DEFAULT_USER_PROFILE.occupation_type as any,
      savings_target: DEFAULT_USER_PROFILE.savings_target,
      updated_at: new Date().toISOString(),
    };
  }

  async updateProfile(
    monthly_budget: number,
    occupation_type: 'student' | 'working',
    savings_target: number
  ): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT OR REPLACE INTO user_profile (id, monthly_budget, occupation_type, savings_target, updated_at)
       VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [monthly_budget, occupation_type, savings_target]
    );
  }
}

export const profileRepo = new ProfileRepository();
