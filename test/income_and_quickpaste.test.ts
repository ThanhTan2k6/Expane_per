import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEmailContent } from '../src/services/regexParser';
import { categorizeSmartTransaction } from '../src/services/autoCategorizer';
import { DEFAULT_KEYWORDS } from '../src/database/schema';
import { transactionRepo } from '../src/database/transactionRepo';
import { resetDatabase } from '../src/database/db';
import { syncEngine } from '../src/services/syncEngine';

test('Income Processing - Parses incoming transfer correctly', async () => {
  const notifText = 'Nhận tiền thành công: Bạn vừa nhận được 500.000đ từ NGUYEN VAN A. Lời nhắn: Tien an thang nay';
  const parsed = parseEmailContent('inc_01', notifText, 'Thông báo MoMo');

  assert.equal(parsed.amount, 500000);
  assert.equal(parsed.isIncome, true);
  assert.equal(parsed.counterparty, 'NGUYEN VAN A');

  // Verify auto-categorization routes to Category 9 (Thu nhập & Nhận tiền)
  const cat = await categorizeSmartTransaction(
    parsed.description,
    parsed.counterparty || '',
    DEFAULT_KEYWORDS as any,
    notifText,
    undefined,
    parsed.isIncome
  );
  assert.equal(cat.categoryId, 9);
});

test('Quick Chat Shorthand - Parses 35k com tam & 500k luong', async () => {
  const expenseChat = '35k com tam';
  const parsedExpense = parseEmailContent('chat_01', expenseChat);
  assert.equal(parsedExpense.amount, 35000);
  assert.equal(parsedExpense.description, 'com tam');
  assert.equal(parsedExpense.isIncome, false);

  const incomeChat = '500k luong';
  const parsedIncome = parseEmailContent('chat_02', incomeChat);
  assert.equal(parsedIncome.amount, 500000);
  assert.equal(parsedIncome.description, 'luong');
  assert.equal(parsedIncome.isIncome, true);
});

test('SyncEngine - processManualText saves to SQLite and updates spending stats', async () => {
  await resetDatabase();

  // 1. Expense: 45,000 VND ShopeeFood
  const res1 = await syncEngine.processManualText('Bạn đã thanh toán 45.000đ cho ShopeeFood');
  assert.equal(res1.success, true);
  assert.equal(res1.transaction?.amount, -45000);

  // 2. Income: 1,000,000 VND Me chuyen
  const res2 = await syncEngine.processManualText('Nhận được 1.000.000đ từ Me chuyen tien');
  assert.equal(res2.success, true);
  assert.equal(res2.transaction?.amount, 1000000);
  assert.equal(res2.transaction?.category_id, 9);

  // 3. Verify total stats
  const stats = await transactionRepo.getTotalSpending();
  assert.equal(stats.expenseTotal, 45000);
  assert.equal(stats.incomeTotal, 1000000);
  assert.equal(stats.count, 2);
});
