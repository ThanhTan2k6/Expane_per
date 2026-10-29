import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseVietnameseAmount,
  parseDateTimeString,
  cleanEmailBody,
  parseEmailContent,
} from '../src/services/regexParser';
import {
  normalizeVietnameseText,
  categorizeSmartTransaction,
} from '../src/services/autoCategorizer';
import { formatVndCurrency, formatTelegramMessage } from '../src/services/telegramService';
import { CategoryKeyword, Transaction } from '../src/types/database';

test('Regex Parser - Vietnamese amount parsing', () => {
  assert.equal(parseVietnameseAmount('45.000đ'), 45000);
  assert.equal(parseVietnameseAmount('1,250,000 VND'), 1250000);
  assert.equal(parseVietnameseAmount('-69.000 đ'), 69000);
  assert.equal(parseVietnameseAmount('+500.000'), 500000);
  assert.equal(parseVietnameseAmount('250000'), 250000);
  assert.equal(parseVietnameseAmount('0 đ'), 0);
  assert.equal(parseVietnameseAmount(''), 0);
});

test('Regex Parser - Date time parsing', () => {
  const parsed1 = parseDateTimeString('26/10/2026 15:30:00');
  const d1 = new Date(parsed1);
  assert.equal(d1.getFullYear(), 2026);
  assert.equal(d1.getMonth(), 9);
  assert.equal(d1.getDate(), 26);
  assert.equal(d1.getHours(), 15);
  assert.equal(d1.getMinutes(), 30);
});

test('Regex Parser - Clean HTML body', () => {
  const html = '<div style="color:red">Số tiền: <b>45.000đ</b>&nbsp;&amp;&nbsp;Cảm ơn</div>';
  const cleaned = cleanEmailBody(html);
  assert.ok(cleaned.includes('Số tiền: 45.000đ & Cảm ơn'));
  assert.ok(!cleaned.includes('<div'));
  assert.ok(!cleaned.includes('&nbsp;'));
});

test('Regex Parser - Counterparty and Description extraction', () => {
  const emailBody = `
    Kính gửi Quý khách,
    Ví MoMo thông báo giao dịch thành công:
    - Người nhận: Bãi giữ xe cổng 1 - Vé xe máy
    - Số tiền thanh toán: 5.000đ
    - Thời gian giao dịch: 26/10/2026 09:20:00
    - Mã giao dịch: 18e47a2f1b09
  `;
  const result = parseEmailContent('msg_123', emailBody, 'Xác nhận giao dịch MoMo');

  assert.equal(result.id, 'msg_123');
  assert.equal(result.amount, 5000);
  assert.equal(result.source, 'momo');
  assert.ok(result.counterparty?.includes('Bãi giữ xe'));
  assert.ok(result.description.includes('Bãi giữ xe'));
});

test('Auto-Categorizer - Vietnamese text normalization', () => {
  assert.equal(normalizeVietnameseText('Ăn uống'), 'an uong');
  assert.equal(normalizeVietnameseText('Trà sữa Phúc Long'), 'tra sua phuc long');
  assert.equal(normalizeVietnameseText('Đi lại & Xe cộ!'), 'di lai xe co');
  assert.equal(normalizeVietnameseText('SHOPEE-FOOD 123'), 'shopee food 123');
});

test('Auto-Categorizer - Smart Priority Keywords and Uncategorized Fallback', async () => {
  const testKeywords: CategoryKeyword[] = [
    { keyword_id: 1, category_id: 1, keyword: 'shopeefood', priority: 2 },
    { keyword_id: 2, category_id: 1, keyword: 'cơm', priority: 1 },
    { keyword_id: 3, category_id: 2, keyword: 'tiền trọ', priority: 2 },
    { keyword_id: 4, category_id: 4, keyword: 'petrolimex', priority: 2 },
    { keyword_id: 5, category_id: 4, keyword: 'gửi xe', priority: 2 },
  ];

  // 1. ShopeeFood -> Category 1
  const res1 = await categorizeSmartTransaction('Thanh toán đơn hàng ShopeeFood #88392', '', testKeywords);
  assert.equal(res1.categoryId, 1);
  assert.equal(res1.matchType, 'smart_keyword');

  // 2. Gửi xe -> Category 4
  const res2 = await categorizeSmartTransaction('Vé gửi xe cổng phụ', '', testKeywords);
  assert.equal(res2.categoryId, 4);

  // 3. Tiền trọ -> Category 2
  const res3 = await categorizeSmartTransaction('Chuyển tiền trọ tháng 10', '', testKeywords);
  assert.equal(res3.categoryId, 2);

  // 4. Unknown merchant with no keywords -> Fallback to 8 ("Chờ xác nhận")
  const res4 = await categorizeSmartTransaction('Chuyển tiền cho bạn A không rõ lý do', '', testKeywords);
  assert.equal(res4.categoryId, 8);
  assert.equal(res4.matchType, 'fallback_uncategorized');
});

test('Auto-Categorizer - Counterparty Memory with Empty Comment', async () => {
  // Simulate mock memory mapping: "NGUYEN VAN A" -> Category 2 (Tiền trọ & Nhà ở)
  const mockMemoryResolver = async (counterparty: string) => {
    if (normalizeVietnameseText(counterparty).includes('nguyen van a')) {
      return 2;
    }
    return null;
  };

  // Transaction has EMPTY comment/description, only counterparty is "NGUYEN VAN A"
  const res = await categorizeSmartTransaction(
    '', // Empty description
    'NGUYEN VAN A', // Counterparty
    [],
    '',
    mockMemoryResolver
  );

  assert.equal(res.categoryId, 2);
  assert.equal(res.matchType, 'counterparty_memory');
  assert.equal(res.confidence, 100);
});

test('Regex Parser - Income vs Expense detection', () => {
  // Test expense
  const expenseMail = parseEmailContent('msg_exp', 'Số tiền thanh toán: 45.000đ tại Highlands', 'Xác nhận GD');
  assert.equal(expenseMail.amount, 45000);
  assert.equal(expenseMail.isIncome, false);

  // Test income / cashback
  const incomeMail = parseEmailContent('msg_inc', 'Bạn vừa nhận được hoàn tiền: +25.000đ từ MoMo Cashback', 'Hoàn tiền MoMo');
  assert.equal(incomeMail.amount, 25000);
  assert.equal(incomeMail.isIncome, true);
});

test('Telegram Service - Formatting test with Essential vs Discretionary Tag', () => {
  const tx: Transaction = {
    id: 'momo_test_999',
    amount: -35000,
    transaction_time: '2026-10-26T14:15:30.000Z',
    description: 'Cơm tấm_sườn & bì chả',
    category_id: 1,
    is_reviewed: 0,
    raw_payload: 'raw',
    created_at: '2026-10-26T14:15:30.000Z',
    is_essential: 1,
  };

  const telegramMsg = formatTelegramMessage(tx, '🍜', 'Ăn uống & Đi chợ', 1);
  assert.ok(telegramMsg.includes('GIAO DỊCH MỚI ĐƯỢC GHI NHẬN'));
  assert.ok(telegramMsg.includes('Cơm tấm_sườn &amp; bì chả'));
  assert.ok(telegramMsg.includes('Thiết yếu'));
  assert.ok(telegramMsg.includes('-35.000'));
});
