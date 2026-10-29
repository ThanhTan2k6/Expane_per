import { AppSettings, DEFAULT_SETTINGS } from '../types/settings';

const SETTINGS_STORAGE_KEY = '@momo_expense_tracker_settings_v1';
const memorySettingsStorage: Record<string, string> = {};

function isNodeTestEnvironment(): boolean {
  return typeof process !== 'undefined' && !!process.versions?.node && typeof (globalThis as any).nativeCallSyncHook === 'undefined';
}

async function storageGetItem(key: string): Promise<string | null> {
  if (isNodeTestEnvironment()) {
    return memorySettingsStorage[key] || null;
  }
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    return await AsyncStorage.getItem(key);
  } catch {
    return memorySettingsStorage[key] || null;
  }
}

async function storageSetItem(key: string, value: string): Promise<void> {
  memorySettingsStorage[key] = value;
  if (isNodeTestEnvironment()) return;
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.setItem(key, value);
  } catch {}
}

async function storageRemoveItem(key: string): Promise<void> {
  delete memorySettingsStorage[key];
  if (isNodeTestEnvironment()) return;
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.removeItem(key);
  } catch {}
}

export class SettingsService {
  async getSettings(): Promise<AppSettings> {
    try {
      const data = await storageGetItem(SETTINGS_STORAGE_KEY);
      if (!data) return DEFAULT_SETTINGS;
      const parsed = JSON.parse(data);
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch (e) {
      console.warn('Failed to read settings:', e);
      return DEFAULT_SETTINGS;
    }
  }

  async saveSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    try {
      const current = await this.getSettings();
      const updated: AppSettings = { ...current, ...settings };
      await storageSetItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.warn('Failed to save settings:', e);
      throw e;
    }
  }

  async resetSettings(): Promise<AppSettings> {
    await storageRemoveItem(SETTINGS_STORAGE_KEY);
    return DEFAULT_SETTINGS;
  }
}

export const settingsService = new SettingsService();
