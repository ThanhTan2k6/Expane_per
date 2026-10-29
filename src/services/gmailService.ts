import { GmailListResponse, GmailMessageDetail, GmailMessagePart } from '../types/gmail';

/**
 * Decode Base64URL string (used by Gmail API for email body) to UTF-8
 */
export function decodeBase64Url(base64UrlStr: string): string {
  if (!base64UrlStr) return '';
  try {
    let base64 = base64UrlStr.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    // Browser / React Native compatible atob or Buffer
    if (typeof atob === 'function') {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new TextDecoder('utf-8').decode(bytes);
    } else if (typeof Buffer !== 'undefined') {
      return Buffer.from(base64, 'base64').toString('utf-8');
    }
  } catch (e) {
    console.warn('Failed to decode base64url:', e);
  }
  return '';
}

/**
 * Recursively extracts plain text or html from Gmail message payload parts
 */
export function extractBodyFromPayload(payload: GmailMessagePart): { text: string; html: string } {
  let text = '';
  let html = '';

  function traverse(part: GmailMessagePart) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      text += decodeBase64Url(part.body.data) + '\n';
    } else if (part.mimeType === 'text/html' && part.body?.data) {
      html += decodeBase64Url(part.body.data) + '\n';
    }

    if (part.parts && Array.isArray(part.parts)) {
      for (const subPart of part.parts) {
        traverse(subPart);
      }
    }
  }

  traverse(payload);

  return { text, html };
}

/**
 * Extract specific header from Gmail payload
 */
export function getHeaderValue(payload: GmailMessagePart, headerName: string): string {
  if (!payload.headers) return '';
  const header = payload.headers.find(
    (h) => h.name.toLowerCase() === headerName.toLowerCase()
  );
  return header ? header.value : '';
}

/**
 * Gmail Service class
 */
export class GmailService {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Search messages by Gmail query
   * e.g., "from:no-reply@momo.vn subject:Xác nhận giao dịch"
   */
  async listMessages(query: string, maxResults: number = 20): Promise<string[]> {
    if (!this.accessToken) {
      throw new Error('Gmail Access Token chưa được cấu hình');
    }

    const encodedQuery = encodeURIComponent(query);
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodedQuery}&maxResults=${maxResults}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gmail API error (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as GmailListResponse;
    return (data.messages || []).map((m) => m.id);
  }

  /**
   * Fetch full message detail by message ID
   */
  async getMessage(messageId: string): Promise<GmailMessageDetail> {
    if (!this.accessToken) {
      throw new Error('Gmail Access Token chưa được cấu hình');
    }

    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gmail API error getting message ${messageId}: ${errText}`);
    }

    return (await res.json()) as GmailMessageDetail;
  }
}

/**
 * Realistic Sample MoMo & Bank emails for offline testing and demos
 */
export const SAMPLE_TRANSACTION_EMAILS = [
  {
    id: 'momo_msg_micro_01',
    subject: 'Xác nhận giao dịch thanh toán MoMo',
    body: `Kính gửi Quý khách,
Bạn đã thanh toán thành công qua MoMo:
- Người nhận: Bãi giữ xe cổng 1 - Vé xe máy
- Số tiền thanh toán: 5.000đ
- Thời gian giao dịch: 26/10/2026 18:05:00
- Mã giao dịch: 8847291012
Cảm ơn quý khách!`,
    internalDate: '1793016300000',
  },
  {
    id: 'momo_msg_micro_02',
    subject: 'Biên nhận giao dịch Bách Hóa Xanh',
    body: `Chào bạn,
MoMo thông báo giao dịch thành công:
- Dịch vụ: Bách Hóa Xanh - Cửa hàng đường số 8
- Số tiền: 42.000 đ
- Thời gian: 26/10/2026 17:30:15
- Nội dung: Mua rau củ và trứng
Cảm ơn bạn đã sử dụng MoMo.`,
    internalDate: '1793014215000',
  },
  {
    id: 'momo_msg_micro_03',
    subject: 'Xác nhận giao dịch đổ xăng Petrolimex',
    body: `Thông báo biến động số dư MoMo:
- Đơn vị chấp nhận thanh toán: Petrolimex Cửa hàng xăng dầu số 12
- Số tiền: 50.000đ
- Thời gian giao dịch: 26/10/2026 12:10:00
- Chi tiết: Đổ xăng xe máy`,
    internalDate: '1792995000000',
  },
  {
    id: 'momo_msg_micro_04',
    subject: 'Xác nhận thanh toán tiền cơm trưa',
    body: `Giao dịch MoMo thành công:
- Cửa hàng: Quán Cơm Tấm Sườn Bì Chả
- Số tiền thanh toán: 35.000đ
- Ngày giao dịch: 26/10/2026 11:45:00
- Nội dung: Cơm trưa`,
    internalDate: '1792993500000',
  },
  {
    id: 'momo_msg_micro_05',
    subject: 'Xác nhận chuyển tiền phòng trọ tháng này',
    body: `Thông báo giao dịch MoMo:
- Người nhận: Tiền trọ phòng 302 - Chị Lan chủ nhà
- Số tiền giao dịch: 2.500.000đ
- Thời gian: 25/10/2026 20:00:00
- Nội dung: Tiền phòng trọ và nước tháng 10`,
    internalDate: '1792936800000',
  },
  {
    id: 'momo_msg_micro_06',
    subject: 'Xác nhận thanh toán phí dịch vụ chuyển tiền',
    body: `Biên nhận giao dịch:
- Dịch vụ: Phí dịch vụ ngân hàng liên kết
- Số tiền: 11.000đ
- Thời gian GD: 24/10/2026 08:30:00`,
    internalDate: '1792809000000',
  },
];
