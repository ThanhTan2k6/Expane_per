import {
  TelegramSendMessageRequest,
  TelegramSendMessageResponse,
  TelegramInlineKeyboardMarkup,
} from '../types/telegram';
import { Transaction } from '../types/database';

export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function formatVndCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));
}

export function formatTelegramMessage(
  transaction: Transaction,
  categoryIcon: string = '🏷️',
  categoryName: string = 'Chờ xác nhận',
  isEssential?: number | null
): string {
  const isIncome = transaction.amount > 0;
  const sign = isIncome ? '+' : '-';
  const formattedAmount = `${sign}${formatVndCurrency(transaction.amount)}`;
  const timeStr = new Date(transaction.transaction_time).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false,
  });

  const essentialTag = isIncome
    ? '💰 Thu nhập / Hoàn tiền'
    : isEssential === 1
    ? '💡 Thiết yếu (Cơm, điện, trọ)'
    : isEssential === 0
    ? '🎉 Phát sinh / Giải trí'
    : '❓ Chờ bạn xác nhận';

  return `🔔 <b>GIAO DỊCH MỚI ĐƯỢC GHI NHẬN!</b>

💸 <b>Số tiền:</b> <code>${formattedAmount}</code>
${categoryIcon} <b>Danh mục:</b> <b>${escapeHtml(categoryName)}</b> [${escapeHtml(essentialTag)}]
📝 <b>Nội dung:</b> ${escapeHtml(transaction.description || 'Không có mô tả')}
⏰ <b>Thời gian:</b> ${timeStr}
🆔 <b>Mã GD:</b> <code>${escapeHtml(transaction.id)}</code>

<i>Dữ liệu lưu an toàn trên SQLite điện thoại của bạn.</i>`;
}

/**
 * Sends a message to the user via Telegram Bot API with optional Inline Keyboard
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string | number,
  text: string,
  replyMarkup?: TelegramInlineKeyboardMarkup
): Promise<{ success: boolean; messageId?: number; error?: string }> {
  if (!botToken || !chatId) {
    return { success: false, error: 'Chưa cấu hình Telegram Bot Token hoặc Chat ID' };
  }

  const cleanToken = botToken.trim();
  const cleanChatId = String(chatId).trim();
  const url = `https://api.telegram.org/bot${cleanToken}/sendMessage`;

  const payload: TelegramSendMessageRequest = {
    chat_id: cleanChatId,
    text,
    parse_mode: 'HTML', // Safe against markdown underscore crashes
    disable_web_page_preview: true,
    reply_markup: replyMarkup,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as TelegramSendMessageResponse;

    if (!response.ok || !data.ok) {
      return {
        success: false,
        error: data.description || `Telegram API error: ${response.status} ${response.statusText}`,
      };
    }

    return {
      success: true,
      messageId: data.result?.message_id,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Lỗi kết nối mạng tới Telegram Bot API',
    };
  }
}

/**
 * Helper to send notification for a newly processed transaction
 */
export async function notifyNewTransaction(
  botToken: string,
  chatId: string | number,
  transaction: Transaction,
  categoryIcon: string = '🏷️',
  categoryName: string = 'Chờ xác nhận',
  isEssential?: number | null
): Promise<{ success: boolean; error?: string }> {
  const text = formatTelegramMessage(transaction, categoryIcon, categoryName, isEssential);

  let replyMarkup: TelegramInlineKeyboardMarkup | undefined = undefined;
  if (!transaction.category_id || transaction.category_id === 8) {
    replyMarkup = {
      inline_keyboard: [
        [
          { text: '🍜 Ăn uống', callback_data: `cat_1_${transaction.id}` },
          { text: '☕ Cafe & Giải trí', callback_data: `cat_6_${transaction.id}` },
        ],
        [
          { text: '🛒 Mua sắm', callback_data: `cat_5_${transaction.id}` },
          { text: '📚 Học tập', callback_data: `cat_3_${transaction.id}` },
        ],
        [
          { text: '🛵 Đi lại & Xe cộ', callback_data: `cat_4_${transaction.id}` },
          { text: '🏠 Nhà ở & Điện nước', callback_data: `cat_2_${transaction.id}` },
        ],
      ],
    };
  }

  return sendTelegramMessage(botToken, chatId, text, replyMarkup);
}

/**
 * Helper to test the bot configuration
 */
export async function testTelegramBot(
  botToken: string,
  chatId: string | number
): Promise<{ success: boolean; error?: string }> {
  const testMessage = `🤖 <b>Thử nghiệm kết nối Telegram Bot thành công!</b>

Ứng dụng Quản lý Chi tiêu Cá nhân (Local SQLite) đã kết nối thành công tới tài khoản Telegram của bạn.
⏰ Thời gian: ${new Date().toLocaleString('vi-VN')}
✨ Sẵn sàng gửi thông báo real-time mỗi khi phát sinh giao dịch MoMo/Ngân hàng!`;

  return sendTelegramMessage(botToken, chatId, testMessage);
}

export interface TelegramIncomingMessage {
  updateId: number;
  messageId: number;
  chatId: number;
  fromName?: string;
  text: string;
  date: number; // Unix timestamp in seconds
}

/**
 * Fetch incoming messages sent to the Telegram Bot (from user or MacroDroid)
 */
export async function fetchTelegramUpdates(
  botToken: string,
  offset?: number
): Promise<{ success: boolean; messages: TelegramIncomingMessage[]; lastUpdateId: number; error?: string }> {
  if (!botToken || !botToken.trim()) {
    return { success: false, messages: [], lastUpdateId: 0, error: 'Chưa cấu hình Telegram Bot Token' };
  }

  const cleanToken = botToken.trim();
  const offsetParam = offset ? `?offset=${offset}&limit=50&allowed_updates=["message"]` : '?limit=50&allowed_updates=["message"]';
  const url = `https://api.telegram.org/bot${cleanToken}/getUpdates${offsetParam}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return { success: false, messages: [], lastUpdateId: 0, error: `Telegram HTTP ${res.status}` };
    }
    const data = await res.json();
    if (!data.ok || !Array.isArray(data.result)) {
      return { success: false, messages: [], lastUpdateId: 0, error: data.description || 'Không thể lấy tin nhắn từ bot' };
    }

    const messages: TelegramIncomingMessage[] = [];
    let maxUpdateId = offset || 0;

    for (const update of data.result) {
      if (update.update_id > maxUpdateId) {
        maxUpdateId = update.update_id;
      }
      if (update.message && update.message.text) {
        messages.push({
          updateId: update.update_id,
          messageId: update.message.message_id,
          chatId: update.message.chat?.id,
          fromName: update.message.from?.first_name,
          text: update.message.text.trim(),
          date: update.message.date,
        });
      }
    }

    return {
      success: true,
      messages,
      lastUpdateId: maxUpdateId,
    };
  } catch (err: any) {
    return { success: false, messages: [], lastUpdateId: 0, error: err.message || 'Lỗi mạng khi gọi Telegram' };
  }
}
