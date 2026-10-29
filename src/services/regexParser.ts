import { ParsedEmailTransaction } from '../types/gmail';

export interface ParsedTransactionExtended extends ParsedEmailTransaction {
  counterparty?: string;
  isIncome?: boolean;
}

/**
 * Utility to strip HTML tags and decode common HTML entities
 */
export function cleanEmailBody(rawContent: string): string {
  if (!rawContent) return '';
  return rawContent
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[\t\r\f]+/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .trim();
}

/**
 * Normalizes number string from Vietnamese currency format
 */
export function parseVietnameseAmount(amountStr: string): number {
  if (!amountStr) return 0;
  let cleaned = amountStr.replace(/[đĐ\sVNvnd+-]/gi, '').trim();

  if (/^\d{1,3}([.,]\d{3})+$/.test(cleaned)) {
    cleaned = cleaned.replace(/[.,]/g, '');
  } else if (/^\d+([.,]\d{2})$/.test(cleaned)) {
    cleaned = cleaned.replace(',', '.');
  } else {
    cleaned = cleaned.replace(/[^\d.]/g, '');
  }

  const result = parseFloat(cleaned);
  return isNaN(result) ? 0 : result;
}

/**
 * Normalizes date time string to ISO string
 */
export function parseDateTimeString(dateStr: string, fallbackTimestamp?: number | string): string {
  if (!dateStr && fallbackTimestamp) {
    const d = new Date(fallbackTimestamp);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }

  if (!dateStr) return new Date().toISOString();

  // DD/MM/YYYY HH:mm[:ss] or DD-MM-YYYY HH:mm[:ss]
  const dmyMatch = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const hours = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const minutes = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const seconds = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;

    const parsedDate = new Date(year, month, day, hours, minutes, seconds);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString();
    }
  }

  // YYYY-MM-DD HH:mm[:ss]
  const ymdMatch = dateStr.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const hours = ymdMatch[4] ? parseInt(ymdMatch[4], 10) : 0;
    const minutes = ymdMatch[5] ? parseInt(ymdMatch[5], 10) : 0;
    const seconds = ymdMatch[6] ? parseInt(ymdMatch[6], 10) : 0;

    const parsedDate = new Date(year, month, day, hours, minutes, seconds);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString();
    }
  }

  const directDate = new Date(dateStr);
  if (!isNaN(directDate.getTime())) {
    return directDate.toISOString();
  }

  if (fallbackTimestamp) {
    const fb = new Date(fallbackTimestamp);
    if (!isNaN(fb.getTime())) return fb.toISOString();
  }

  return new Date().toISOString();
}

/**
 * Main Regex Parser for MoMo and Vietnamese Banks (MB, Techcombank, VCB)
 */
export function parseEmailContent(
  messageId: string,
  rawContent: string,
  subject: string = '',
  internalDate?: string
): ParsedTransactionExtended {
  const cleanText = cleanEmailBody(rawContent);
  const combined = `${subject}\n${cleanText}`;

  // Detect source
  let source: ParsedEmailTransaction['source'] = 'generic';
  if (/momo/i.test(combined) || /from:.*momo\.vn/i.test(rawContent)) {
    source = 'momo';
  } else if (/vietcombank|vcb/i.test(combined)) {
    source = 'vcb';
  } else if (/techcombank|tcb/i.test(combined)) {
    source = 'tcb';
  } else if (/mbbank|ngan hang quan doi/i.test(combined)) {
    source = 'mbbank';
  } else if (/tpbank|tien phong/i.test(combined)) {
    source = 'tpbank';
  }

  // Detect if transaction is incoming (income / cashback) or outgoing (expense)
  let isIncome = false;
  if (/\+\s*[\d.,]+\s*(?:đ|VND|Đ)?/i.test(cleanText) || /\+\s*[\d.,]+/i.test(subject)) {
    isIncome = true;
  }
  if (/nhận tiền|nhan tien|hoàn tiền|hoan tien|tiền về|tien ve|tiền vào|tien vao|lương|luong|cashback|cộng tiền|cong tien|chuyển tiền đến|chuyen tien den|thụ hưởng thành công|thu huong thanh cong/i.test(combined)) {
    isIncome = true;
  }

  // 1. Amount Extraction
  let amount = 0;
  let description = '';
  const amountPatterns = [
    /(?:Số tiền thanh toán|Số tiền giao dịch|Số tiền GD|Số tiền|Giao dịch|Tổng tiền|Biến động|Thanh toán|Giá trị GD|Số dư thay đổi|Hoàn tiền|Nhận tiền|Cộng tiền)[\s:]*([+-]?\s*[\d.,]+)\s*(?:đ|VND|Đ)?/i,
    /(?:Số tiền thanh toán|Số tiền giao dịch|Số tiền GD|Số tiền|Giao dịch|Tổng tiền|Biến động|Thanh toán|Giá trị GD|Số dư thay đổi)[\s:]*([+-]?\s*[\d.,]+)/i,
    /([+-]?\s*[\d.,]+)\s*(?:đ|VND|Đ)(?!\w)/i,
  ];

  for (const pattern of amountPatterns) {
    const match = cleanText.match(pattern);
    if (match && match[1]) {
      const parsed = parseVietnameseAmount(match[1]);
      if (parsed > 0) {
        amount = parsed;
        break;
      }
    }
  }

  // Quick chat shorthand: "35k com tam", "500k luong", "1.5tr tien tro"
  if (amount === 0) {
    const quickMatch = cleanText.match(/^([+-]?\s*\d+(?:[.,]\d+)?)\s*(k|tr|trieu|triệu|nghin|nghìn)\b(?:\s+(.*))?/i);
    if (quickMatch) {
      const num = parseFloat(quickMatch[1].replace(',', '.'));
      const unit = quickMatch[2].toLowerCase();
      if (unit === 'k' || unit === 'nghin' || unit === 'nghìn') {
        amount = num * 1000;
      } else if (unit === 'tr' || unit === 'trieu' || unit === 'triệu') {
        amount = num * 1000000;
      }
      if (quickMatch[3]) {
        description = quickMatch[3].trim();
      }
    }
  }

  if (amount === 0 && subject) {
    const subjMatch = subject.match(/([+-]?\s*[\d.,]+)\s*(?:đ|VND|Đ)/i);
    if (subjMatch && subjMatch[1]) {
      amount = parseVietnameseAmount(subjMatch[1]);
    }
  }

  // 2. Transaction Time Extraction
  let transactionTime = '';
  const timePatterns = [
    /(?:Thời gian thanh toán|Thời gian giao dịch|Thời gian GD|Ngày giao dịch|Thời gian|Ngày GD)[\s:]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)/i,
    /(?:Thời gian thanh toán|Thời gian giao dịch|Thời gian GD|Ngày giao dịch|Thời gian|Ngày GD)[\s:]*(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)/i,
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?)/,
  ];

  for (const pattern of timePatterns) {
    const match = cleanText.match(pattern);
    if (match && match[1]) {
      transactionTime = parseDateTimeString(match[1], internalDate);
      break;
    }
  }

  if (!transactionTime) {
    transactionTime = parseDateTimeString('', internalDate);
  }

  // 3. Counterparty Name Extraction (Tên người gửi / người nhận)
  let counterparty = '';
  const counterpartyPatterns = [
    /(?:Người nhận|Tên người nhận|Đơn vị thụ hưởng|Tài khoản thụ hưởng|Tên đối tác|Đơn vị chấp nhận thanh toán|Cửa hàng|Nhà cung cấp)[\s:]*([^\r\n.;]+)/i,
    /(?:Người gửi|Tên người gửi|Tài khoản chuyển)[\s:]*([^\r\n.;]+)/i,
    /(?:Tại|Tai)[\s:]*([^\r\n.;]+)/i,
  ];

  for (const pattern of counterpartyPatterns) {
    const match = cleanText.match(pattern);
    if (match && match[1]) {
      const candidate = match[1].trim();
      if (candidate.length > 2 && !/^(thành công|that bai|hoan tat)$/i.test(candidate)) {
        counterparty = candidate.replace(/[<>:"/\\|?*]/g, '').trim().slice(0, 100);
        break;
      }
    }
  }

  // Notif format: "thanh toán ... cho Cơm tấm Ba Ghiền" / "chuyển tiền ... đến Mixue"
  if (!counterparty) {
    const notifMatch = cleanText.match(/(?:thanh toán|chuyển tiền|thanh toan)\s+[\d.,]+\s*(?:đ|VND|Đ|k)?\s+(?:cho|tại|tai|đến)\s+([^.,;]+)/i);
    if (notifMatch && notifMatch[1]) {
      counterparty = notifMatch[1].trim().slice(0, 100);
    }
  }

  // Incoming Notif format: "nhận được ... từ NGUYEN VAN A"
  if (!counterparty) {
    const incomingMatch = cleanText.match(/(?:nhận được|nhận|nhan duoc)\s+[\d.,]+\s*(?:đ|VND|Đ|k)?\s+từ\s+([^.,;]+)/i);
    if (incomingMatch && incomingMatch[1]) {
      counterparty = incomingMatch[1].trim().slice(0, 100);
      isIncome = true;
    }
  }

  // 4. Description Extraction
  const descPatterns = [
    /(?:Nội dung chi tiết|Nội dung thanh toán|Nội dung giao dịch|Nội dung GD|Nội dung|Mô tả|Chi tiết GD|Ghi chú|Dịch vụ)[\s:]*([^\r\n.;]+)/i,
  ];

  for (const pattern of descPatterns) {
    const match = cleanText.match(pattern);
    if (match && match[1]) {
      const candidate = match[1].trim();
      if (candidate.length > 2 && !/^(thành công|that bai|hoan tat)$/i.test(candidate)) {
        description = candidate;
        break;
      }
    }
  }

  // If description is empty or missing comment, use counterparty name!
  if (!description && counterparty) {
    description = counterparty;
  }

  // Fallback description from subject or generic source
  if (!description) {
    if (subject && !/Xác nhận giao dịch/i.test(subject)) {
      description = subject;
    } else if (source === 'momo') {
      description = 'Giao dịch MoMo';
    } else {
      description = `Giao dịch ${source.toUpperCase()}`;
    }
  }

  description = description.replace(/[<>:"/\\|?*]/g, '').trim().slice(0, 200);

  return {
    id: messageId,
    amount,
    transactionTime,
    description,
    counterparty,
    isIncome,
    source,
    rawPayload: rawContent,
  };
}
