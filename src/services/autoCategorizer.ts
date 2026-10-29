import { CategoryKeyword } from '../types/database';

/**
 * Remove Vietnamese accents/diacritics and normalize to lowercase
 */
export function normalizeVietnameseText(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Remove all spaces and punctuation for fuzzy spaceless matching
 */
export function removeSpacesAndAccents(str: string): string {
  return normalizeVietnameseText(str).replace(/\s+/g, '');
}

export interface CategorizationResult {
  categoryId: number;
  matchedKeyword: string | null;
  confidence: number;
  matchType: 'counterparty_memory' | 'smart_keyword' | 'fallback_uncategorized';
}

/**
 * Categorizes a transaction using Counterparty Memory -> Smart Keyword Rules -> Uncategorized Fallback
 */
export async function categorizeSmartTransaction(
  description: string,
  counterpartyName: string = '',
  keywords: CategoryKeyword[] = [],
  rawPayload: string = '',
  counterpartyResolver?: (name: string) => Promise<number | null>,
  isIncome?: boolean
): Promise<CategorizationResult> {
  // Step 1: Counterparty Memory (Lưu nhớ lịch sử đối tượng)
  if (counterpartyName && counterpartyName.trim().length > 0) {
    let rememberedCatId: number | null = null;
    if (counterpartyResolver) {
      rememberedCatId = await counterpartyResolver(counterpartyName);
    } else {
      try {
        const { counterpartyRepo } = await import('../database/counterpartyRepo');
        rememberedCatId = await counterpartyRepo.findCategoryByCounterparty(counterpartyName);
      } catch (e) {
        // Fallback for isolated test environments
      }
    }

    if (rememberedCatId !== null && rememberedCatId !== undefined) {
      return {
        categoryId: rememberedCatId,
        matchedKeyword: counterpartyName,
        confidence: 100,
        matchType: 'counterparty_memory',
      };
    }
  }

  // Step 2: Smart Keyword Rules with Priority
  const combinedText = `${description} ${counterpartyName}`.trim();
  const normalizedText = normalizeVietnameseText(combinedText);
  const spacelessText = removeSpacesAndAccents(combinedText);
  const normalizedRaw = normalizeVietnameseText(rawPayload.slice(0, 500));

  let bestMatch: CategorizationResult | null = null;
  let highestScore = 0;

  for (const rule of keywords) {
    const normKw = normalizeVietnameseText(rule.keyword);
    const spacelessKw = removeSpacesAndAccents(rule.keyword);
    if (!normKw) continue;

    // Word boundary or inclusion
    const isExactPhrase = normalizedText.includes(normKw);
    const isSpacelessMatch = spacelessKw.length >= 4 && spacelessText.includes(spacelessKw);

    if (isExactPhrase || isSpacelessMatch) {
      // Calculate score = (priority * 50) + (keyword length * 2) + whole word bonus
      const regex = new RegExp(`(^|\\s)${normKw}(\\s|$)`, 'i');
      const isWholeWord = regex.test(normalizedText);
      const score = (rule.priority || 1) * 50 + normKw.length * 2 + (isWholeWord ? 20 : 0);

      if (score > highestScore) {
        highestScore = score;
        bestMatch = {
          categoryId: rule.category_id,
          matchedKeyword: rule.keyword,
          confidence: score,
          matchType: 'smart_keyword',
        };
      }
    } else if (normalizedRaw.includes(normKw)) {
      const score = (rule.priority || 1) * 20 + normKw.length;
      if (score > highestScore) {
        highestScore = score;
        bestMatch = {
          categoryId: rule.category_id,
          matchedKeyword: rule.keyword,
          confidence: score,
          matchType: 'smart_keyword',
        };
      }
    }
  }

  if (bestMatch) {
    return bestMatch;
  }

  // If this transaction is detected as Income, assign to Category 9 (Thu nhập & Nhận tiền)
  if (isIncome) {
    return {
      categoryId: 9,
      matchedKeyword: 'Thu nhập',
      confidence: 90,
      matchType: 'smart_keyword',
    };
  }

  // Step 3: Fallback Category = 8 ("Chờ xác nhận" / Uncategorized)
  return {
    categoryId: 8,
    matchedKeyword: null,
    confidence: 0,
    matchType: 'fallback_uncategorized',
  };
}
