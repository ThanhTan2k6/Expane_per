import { transactionRepo } from '../database/transactionRepo';
import { counterpartyRepo } from '../database/counterpartyRepo';
import { categoryRepo } from '../database/categoryRepo';
import { normalizeVietnameseText } from './autoCategorizer';

export interface LearnResult {
  transactionId: string;
  categoryId: number;
  rememberedCounterparty?: string;
  learnedKeyword?: string;
}

/**
 * Self-learning mechanism triggered when user manually corrects a transaction's category
 */
export async function learnFromUserCorrection(
  transactionId: string,
  newCategoryId: number
): Promise<LearnResult> {
  // 1. Update transaction and mark is_reviewed = 1
  await transactionRepo.updateCategory(transactionId, newCategoryId);

  const tx = await transactionRepo.getById(transactionId);
  const result: LearnResult = {
    transactionId,
    categoryId: newCategoryId,
  };

  if (!tx) return result;

  // 2. Counterparty Memory: If description or counterparty contains person/store name
  // Extract counterparty or clean merchant name
  const rawDesc = tx.description.trim();
  const normalized = normalizeVietnameseText(rawDesc);

  // If description has a clear recipient or store name (e.g., "Highlands Coffee", "NGUYEN VAN A")
  if (rawDesc.length > 2) {
    // Save to counterparty memory
    await counterpartyRepo.rememberCounterparty(rawDesc, newCategoryId);
    result.rememberedCounterparty = rawDesc;

    // Check if it's a short unique keyword to also add into category_keywords
    const words = normalized.split(/\s+/).filter((w) => w.length > 2);
    if (words.length <= 4) {
      // Add as smart keyword rule with priority 2
      await categoryRepo.addKeyword(newCategoryId, normalized, 2);
      result.learnedKeyword = normalized;
    }
  }

  return result;
}
