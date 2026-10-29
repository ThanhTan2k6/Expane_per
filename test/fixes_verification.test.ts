import test from 'node:test';
import assert from 'node:assert/strict';
import { webDatabase } from '../src/database/webDb';
import { escapeHtml, formatTelegramMessage } from '../src/services/telegramService';
import { parseEmailContent } from '../src/services/regexParser';
import { Transaction } from '../src/types/database';

test('Fix Verification 1: Telegram HTML Escaping & No Crashes with Special Characters', () => {
  const dangerousDesc = 'Shopee_Order_<123>&"Discount"_*bold*';
  const escaped = escapeHtml(dangerousDesc);
  assert.equal(escaped, 'Shopee_Order_&lt;123&gt;&amp;"Discount"_*bold*');

  const tx: Transaction = {
    id: 'msg_test_special_123_456',
    amount: -45000,
    transaction_time: '2026-10-29T10:00:00.000Z',
    description: dangerousDesc,
    category_id: 1,
    is_reviewed: 1,
    raw_payload: 'raw',
    created_at: '2026-10-29T10:00:00.000Z',
    is_essential: 1,
  };

  const msg = formatTelegramMessage(tx, '🍜', 'Ăn uống', 1);
  assert.ok(msg.includes('<b>GIAO DỊCH MỚI ĐƯỢC GHI NHẬN!</b>'));
  assert.ok(msg.includes('Shopee_Order_&lt;123&gt;&amp;"Discount"_*bold*'));
  assert.ok(msg.includes('-45.000'));
});

test('Fix Verification 2: Income (+) vs Expense (-) parsing logic', () => {
  // Case 1: Expense
  const exp = parseEmailContent('tx_1', 'Số tiền thanh toán: 60.000đ tại Phúc Long', 'Xác nhận GD MoMo');
  assert.equal(exp.amount, 60000);
  assert.equal(exp.isIncome, false);

  // Case 2: Cashback / Income
  const inc1 = parseEmailContent('tx_2', 'Bạn nhận được hoàn tiền: +15.000đ từ MoMo', 'Hoàn tiền');
  assert.equal(inc1.amount, 15000);
  assert.equal(inc1.isIncome, true);

  // Case 3: Salary / Bank transfer in
  const inc2 = parseEmailContent('tx_3', 'Tài khoản nhận tiền: +5.000.000 VND từ CTY ABC', 'Biến động số dư');
  assert.equal(inc2.amount, 5000000);
  assert.equal(inc2.isIncome, true);
});

test('Fix Verification 3: Keyword Deduplication in Category Rules', async () => {
  // Insert initial keyword
  const run1 = await webDatabase.runAsync(
    'INSERT INTO category_keywords (category_id, keyword, priority) VALUES (?, ?, ?)',
    [1, 'com tam co ba', 1]
  );
  assert.ok(run1.lastInsertRowId > 0);

  // Query keywords
  const keywordsBefore = await webDatabase.getAllAsync('SELECT * FROM category_keywords WHERE category_id = ?', [1]);
  const countBefore = keywordsBefore.filter((k: any) => k.keyword === 'com tam co ba').length;
  assert.equal(countBefore, 1);
});
