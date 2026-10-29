import { GmailService, extractBodyFromPayload, getHeaderValue, SAMPLE_TRANSACTION_EMAILS } from './gmailService';
import { parseEmailContent } from './regexParser';
import { categorizeSmartTransaction } from './autoCategorizer';
import { transactionRepo } from '../database/transactionRepo';
import { categoryRepo } from '../database/categoryRepo';
import { notifyNewTransaction, fetchTelegramUpdates } from './telegramService';
import { settingsService } from './settingsService';
import { Transaction } from '../types/database';

export interface SyncReport {
  timestamp: string;
  totalEmailsScanned: number;
  newTransactionsCount: number;
  skippedDuplicatesCount: number;
  errorsCount: number;
  telegramNotifiedCount: number;
  processedTransactions: Transaction[];
  message: string;
}

type SyncListener = (report: SyncReport) => void;

export class SyncEngine {
  private listeners: Set<SyncListener> = new Set();

  /**
   * Subscribe to sync events for real-time UI updates
   */
  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(report: SyncReport) {
    this.listeners.forEach((l) => {
      try {
        l(report);
      } catch (err) {
        console.warn('Sync listener callback error:', err);
      }
    });
  }

  /**
   * Main synchronization execution flow
   */
  async runSync(forceSampleData: boolean = false): Promise<SyncReport> {
    const startTime = new Date().toISOString();
    const settings = await settingsService.getSettings();
    const keywords = await categoryRepo.getKeywords();

    const report: SyncReport = {
      timestamp: startTime,
      totalEmailsScanned: 0,
      newTransactionsCount: 0,
      skippedDuplicatesCount: 0,
      errorsCount: 0,
      telegramNotifiedCount: 0,
      processedTransactions: [],
      message: '',
    };

    try {
      let rawEmailsToProcess: Array<{
        id: string;
        subject: string;
        body: string;
        internalDate?: string;
      }> = [];

      if (!forceSampleData && settings.telegramBotToken) {
        // Query Telegram Bot API for forwarded notifications or user chats
        const tgUpdates = await fetchTelegramUpdates(settings.telegramBotToken);
        if (tgUpdates.success && tgUpdates.messages.length > 0) {
          report.totalEmailsScanned += tgUpdates.messages.length;
          for (const msg of tgUpdates.messages) {
            rawEmailsToProcess.push({
              id: `tg_${msg.messageId}`,
              subject: 'Thông báo MoMo/Ngân hàng',
              body: msg.text,
              internalDate: String(msg.date * 1000),
            });
          }
        }
      }

      if (!forceSampleData && settings.gmailAccessToken) {
        // Query Gmail API if configured
        try {
          const gmail = new GmailService(settings.gmailAccessToken);
          const query = settings.gmailQuery || 'from:no-reply@momo.vn subject:Xác nhận giao dịch';
          const messageIds = await gmail.listMessages(query, 20);

          report.totalEmailsScanned += messageIds.length;

          for (const msgId of messageIds) {
            try {
              const detail = await gmail.getMessage(msgId);
              const { text, html } = extractBodyFromPayload(detail.payload);
              const subject = getHeaderValue(detail.payload, 'Subject');
              rawEmailsToProcess.push({
                id: detail.id,
                subject,
                body: text || html || detail.snippet || '',
                internalDate: detail.internalDate,
              });
            } catch (e) {
              console.warn(`Failed to fetch message ${msgId}:`, e);
              report.errorsCount++;
            }
          }
        } catch (gErr) {
          console.warn('Gmail sync skipped:', gErr);
        }
      }

      if (
        rawEmailsToProcess.length === 0 &&
        (forceSampleData || (!settings.telegramBotToken && !settings.gmailAccessToken))
      ) {
        // Use realistic sample emails for local testing/demo
        report.totalEmailsScanned = SAMPLE_TRANSACTION_EMAILS.length;
        rawEmailsToProcess = SAMPLE_TRANSACTION_EMAILS;
      }

      if (rawEmailsToProcess.length === 0) {
        report.message = 'Không tìm thấy email giao dịch mới nào phù hợp.';
        await settingsService.saveSettings({
          lastSyncTime: new Date().toISOString(),
          lastSyncStatus: 'success',
          lastSyncMessage: report.message,
        });
        return report;
      }

      // 2. Deduplication
      const emailIds = rawEmailsToProcess.map((e) => e.id);
      const existingIdSet = await transactionRepo.getExistingIds(emailIds);

      const newEmails = rawEmailsToProcess.filter((e) => {
        if (existingIdSet.has(e.id)) {
          report.skippedDuplicatesCount++;
          return false;
        }
        return true;
      });

      if (newEmails.length === 0) {
        report.message = `Đã kiểm tra ${report.totalEmailsScanned} email. Tất cả ${report.skippedDuplicatesCount} giao dịch đã được đồng bộ trước đó.`;
        await settingsService.saveSettings({
          lastSyncTime: new Date().toISOString(),
          lastSyncStatus: 'success',
          lastSyncMessage: report.message,
        });
        return report;
      }

      // 3. Process each new email
      for (const email of newEmails) {
        try {
          // Step 3: Regex Extraction
          const parsed = parseEmailContent(
            email.id,
            email.body,
            email.subject,
            email.internalDate
          );

          if (parsed.amount <= 0) {
            report.errorsCount++;
            continue;
          }

          // Step 4: Smart Auto-Tagging (Counterparty Memory -> Keywords -> Fallback)
          const catResult = await categorizeSmartTransaction(
            parsed.description,
            parsed.counterparty || '',
            keywords,
            email.body,
            undefined,
            parsed.isIncome
          );

          // Step 5: Save to SQLite local database (Income is positive, Expense is negative)
          const finalAmount = parsed.isIncome ? Math.abs(parsed.amount) : -Math.abs(parsed.amount);

          await transactionRepo.insert({
            id: parsed.id,
            amount: finalAmount,
            transaction_time: parsed.transactionTime,
            description: parsed.description,
            category_id: catResult.categoryId,
            is_reviewed: 0, // Machine auto-predicted
            raw_payload: parsed.rawPayload,
          });

          // Fetch the inserted record with joined category
          const savedTx = await transactionRepo.getById(parsed.id);
          if (savedTx) {
            report.processedTransactions.push(savedTx);
            report.newTransactionsCount++;

            // Step 6: Real-time Telegram Notification
            if (
              settings.telegramNotifyEnabled &&
              settings.telegramBotToken &&
              settings.telegramChatId
            ) {
              const notifyResult = await notifyNewTransaction(
                settings.telegramBotToken,
                settings.telegramChatId,
                savedTx,
                savedTx.category_icon || '❓',
                savedTx.category_name || 'Chờ xác nhận',
                savedTx.is_essential
              );

              if (notifyResult.success) {
                report.telegramNotifiedCount++;
              } else {
                console.warn('Telegram notification failed:', notifyResult.error);
              }
            }
          }
        } catch (itemErr) {
          console.error(`Error processing email ${email.id}:`, itemErr);
          report.errorsCount++;
        }
      }

      report.message = `Đã đồng bộ thành công ${report.newTransactionsCount} giao dịch mới. Bỏ qua ${report.skippedDuplicatesCount} giao dịch trùng. Đã gửi ${report.telegramNotifiedCount} thông báo Telegram.`;

      await settingsService.saveSettings({
        lastSyncTime: new Date().toISOString(),
        lastSyncStatus: 'success',
        lastSyncMessage: report.message,
      });

      this.notify(report);
      return report;
    } catch (globalErr: any) {
      report.message = `Lỗi trong quá trình đồng bộ: ${globalErr.message || globalErr}`;
      report.errorsCount++;

      await settingsService.saveSettings({
        lastSyncTime: new Date().toISOString(),
        lastSyncStatus: 'error',
        lastSyncMessage: report.message,
      });

      this.notify(report);
      return report;
    }
  }

  /**
   * Process a single text string manually (from Clipboard or Quick Add)
   */
  async processManualText(
    rawText: string,
    overrideCategoryId?: number
  ): Promise<{ success: boolean; transaction?: Transaction; error?: string }> {
    const text = rawText.trim();
    if (!text) return { success: false, error: 'Nội dung thông báo trống' };

    const id = `notif_${Date.now()}`;
    const parsed = parseEmailContent(id, text, 'Thông báo giao dịch');

    if (parsed.amount <= 0) {
      return { success: false, error: 'Không tìm thấy số tiền hợp lệ trong thông báo' };
    }

    const keywords = await categoryRepo.getKeywords();
    const catResult = await categorizeSmartTransaction(
      parsed.description,
      parsed.counterparty || '',
      keywords,
      text,
      undefined,
      parsed.isIncome
    );

    const categoryId = overrideCategoryId || catResult.categoryId;
    const finalAmount = parsed.isIncome ? Math.abs(parsed.amount) : -Math.abs(parsed.amount);

    await transactionRepo.insert({
      id: parsed.id,
      amount: finalAmount,
      transaction_time: parsed.transactionTime,
      description: parsed.description,
      category_id: categoryId,
      is_reviewed: 1, // User confirmed/pasted
      raw_payload: text,
    });

    const savedTx = await transactionRepo.getById(parsed.id);
    const settings = await settingsService.getSettings();

    if (
      savedTx &&
      settings.telegramNotifyEnabled &&
      settings.telegramBotToken &&
      settings.telegramChatId
    ) {
      await notifyNewTransaction(
        settings.telegramBotToken,
        settings.telegramChatId,
        savedTx,
        savedTx.category_icon || '💰',
        savedTx.category_name || 'Giao dịch',
        savedTx.is_essential
      );
    }

    this.notify({
      timestamp: new Date().toISOString(),
      totalEmailsScanned: 1,
      newTransactionsCount: 1,
      skippedDuplicatesCount: 0,
      errorsCount: 0,
      telegramNotifiedCount: 1,
      processedTransactions: savedTx ? [savedTx] : [],
      message: 'Đã lưu giao dịch thành công!',
    });

    return { success: true, transaction: savedTx || undefined };
  }
}

export const syncEngine = new SyncEngine();
