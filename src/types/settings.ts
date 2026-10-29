export interface AppSettings {
  // Gmail API configuration
  gmailQuery: string; // Default: 'from:no-reply@momo.vn subject:Xác nhận giao dịch'
  gmailAccessToken: string; // OAuth2 Access Token
  gmailRefreshToken?: string;
  gmailClientId?: string;

  // Telegram Bot configuration
  telegramBotToken: string;
  telegramChatId: string;
  telegramNotifyEnabled: boolean;

  // Background Sync configuration
  backgroundSyncEnabled: boolean;
  syncIntervalMinutes: number; // e.g. 15, 30, 60 minutes
  lastSyncTime?: string | null;
  lastSyncStatus?: 'success' | 'error' | 'idle' | 'running';
  lastSyncMessage?: string | null;
}

export const DEFAULT_SETTINGS: AppSettings = {
  gmailQuery: 'from:no-reply@momo.vn subject:Xác nhận giao dịch',
  gmailAccessToken: '',
  gmailRefreshToken: '',
  gmailClientId: '',
  telegramBotToken: '',
  telegramChatId: '',
  telegramNotifyEnabled: true,
  backgroundSyncEnabled: true,
  syncIntervalMinutes: 15,
  lastSyncTime: null,
  lastSyncStatus: 'idle',
  lastSyncMessage: null,
};
