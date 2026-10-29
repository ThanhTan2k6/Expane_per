export const CREATE_USER_PROFILE_TABLE = `
CREATE TABLE IF NOT EXISTS user_profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    monthly_budget REAL NOT NULL,
    occupation_type TEXT NOT NULL,
    savings_target REAL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

export const CREATE_CATEGORIES_TABLE = `
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT,
    budget_limit REAL DEFAULT 0,
    is_essential BOOLEAN DEFAULT 1
);
`;

export const CREATE_CATEGORY_KEYWORDS_TABLE = `
CREATE TABLE IF NOT EXISTS category_keywords (
    keyword_id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    keyword TEXT NOT NULL,
    priority INTEGER DEFAULT 1,
    FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
);
`;

export const CREATE_COUNTERPARTY_RULES_TABLE = `
CREATE TABLE IF NOT EXISTS counterparty_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    counterparty_name TEXT NOT NULL UNIQUE,
    category_id INTEGER NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
);
`;

export const CREATE_TRANSACTIONS_TABLE = `
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    amount REAL NOT NULL,
    transaction_time DATETIME NOT NULL,
    description TEXT NOT NULL,
    category_id INTEGER,
    is_reviewed BOOLEAN DEFAULT 0,
    raw_payload TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL
);
`;

export const CREATE_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_transactions_time ON transactions(transaction_time DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_keywords_word ON category_keywords(keyword);
CREATE INDEX IF NOT EXISTS idx_counterparty_name ON counterparty_rules(counterparty_name);
`;

// Seed data: Student case (3,000,000 VND budget, 500,000 VND savings)
export const DEFAULT_USER_PROFILE = {
  id: 1,
  monthly_budget: 3000000,
  occupation_type: 'student',
  savings_target: 500000,
};

export interface DefaultCategorySeed {
  id: number;
  name: string;
  icon: string;
  budget_limit: number;
  is_essential: number;
}

export const DEFAULT_CATEGORIES: DefaultCategorySeed[] = [
  { id: 1, name: 'Ăn uống & Đi chợ', icon: '🍜', budget_limit: 1200000, is_essential: 1 },
  { id: 2, name: 'Nhà ở & Điện nước', icon: '🏠', budget_limit: 1000000, is_essential: 1 },
  { id: 3, name: 'Học tập & Tài liệu', icon: '📚', budget_limit: 200000, is_essential: 1 },
  { id: 4, name: 'Đi lại & Xe cộ', icon: '🛵', budget_limit: 200000, is_essential: 1 },
  { id: 5, name: 'Mua sắm cá nhân', icon: '🛒', budget_limit: 200000, is_essential: 0 },
  { id: 6, name: 'Giải trí & Cafe', icon: '☕', budget_limit: 200000, is_essential: 0 },
  { id: 7, name: 'Y tế & Sức khỏe', icon: '💊', budget_limit: 0, is_essential: 1 },
  { id: 8, name: 'Chờ xác nhận', icon: '❓', budget_limit: 0, is_essential: 0 }, // Fallback category
  { id: 9, name: 'Thu nhập & Nhận tiền', icon: '💰', budget_limit: 0, is_essential: 0 }, // Income category
];

export interface DefaultKeywordSeed {
  category_id: number;
  keyword: string;
  priority: number;
}

export const DEFAULT_KEYWORDS: DefaultKeywordSeed[] = [
  // [1: Ăn uống & Đi chợ]
  { category_id: 1, keyword: 'shopeefood', priority: 2 },
  { category_id: 1, keyword: 'grabfood', priority: 2 },
  { category_id: 1, keyword: 'baemin', priority: 2 },
  { category_id: 1, keyword: 'winmart', priority: 1 },
  { category_id: 1, keyword: 'bach hoa xanh', priority: 1 },
  { category_id: 1, keyword: 'circle k', priority: 1 },
  { category_id: 1, keyword: 'co.opmart', priority: 1 },
  { category_id: 1, keyword: 'an sang', priority: 1 },
  { category_id: 1, keyword: 'com', priority: 1 },
  { category_id: 1, keyword: 'pho', priority: 1 },
  { category_id: 1, keyword: 'bun', priority: 1 },
  { category_id: 1, keyword: 'banh mi', priority: 1 },
  { category_id: 1, keyword: 'nuoc mia', priority: 1 },
  { category_id: 1, keyword: 'tap hoa', priority: 1 },

  // [2: Nhà ở & Điện nước]
  { category_id: 2, keyword: 'dien luc', priority: 2 },
  { category_id: 2, keyword: 'tien phong', priority: 2 },
  { category_id: 2, keyword: 'tien tro', priority: 2 },
  { category_id: 2, keyword: 'nuoc sinh hoat', priority: 1 },
  { category_id: 2, keyword: 'evn', priority: 2 },
  { category_id: 2, keyword: 'cap nuoc', priority: 1 },
  { category_id: 2, keyword: 'wifi', priority: 1 },
  { category_id: 2, keyword: 'internet', priority: 1 },

  // [3: Học tập & Tài liệu]
  { category_id: 3, keyword: 'sach', priority: 1 },
  { category_id: 3, keyword: 'photo', priority: 1 },
  { category_id: 3, keyword: 'truong dai hoc', priority: 2 },
  { category_id: 3, keyword: 'hoc phi', priority: 2 },
  { category_id: 3, keyword: 'udemy', priority: 2 },
  { category_id: 3, keyword: 'coursera', priority: 2 },
  { category_id: 3, keyword: 'tai lieu', priority: 1 },
  { category_id: 3, keyword: 'in an', priority: 1 },

  // [4: Đi lại & Xe cộ]
  { category_id: 4, keyword: 'grabike', priority: 2 },
  { category_id: 4, keyword: 'bebike', priority: 2 },
  { category_id: 4, keyword: 'gojek', priority: 2 },
  { category_id: 4, keyword: 'petrolimex', priority: 2 },
  { category_id: 4, keyword: 'cay xang', priority: 1 },
  { category_id: 4, keyword: 'xang', priority: 1 },
  { category_id: 4, keyword: 'gui xe', priority: 2 },
  { category_id: 4, keyword: 'giu xe', priority: 2 },
  { category_id: 4, keyword: 've xe', priority: 2 },
  { category_id: 4, keyword: 'vetc', priority: 2 },
  { category_id: 4, keyword: 'epass', priority: 2 },

  // [5: Mua sắm cá nhân]
  { category_id: 5, keyword: 'shopee', priority: 1 },
  { category_id: 5, keyword: 'lazada', priority: 1 },
  { category_id: 5, keyword: 'tiki', priority: 1 },
  { category_id: 5, keyword: 'tiktok shop', priority: 2 },
  { category_id: 5, keyword: 'hasaki', priority: 1 },

  // [6: Giải trí & Cafe]
  { category_id: 6, keyword: 'highlands', priority: 2 },
  { category_id: 6, keyword: 'phuc long', priority: 2 },
  { category_id: 6, keyword: 'cafe', priority: 1 },
  { category_id: 6, keyword: 'ca phe', priority: 1 },
  { category_id: 6, keyword: 'steam', priority: 2 },
  { category_id: 6, keyword: 'garena', priority: 2 },
  { category_id: 6, keyword: 'netflix', priority: 2 },
  { category_id: 6, keyword: 'cgv', priority: 2 },
  { category_id: 6, keyword: 'lotte cinema', priority: 2 },

  // [7: Y tế & Sức khỏe]
  { category_id: 7, keyword: 'nha thuoc', priority: 2 },
  { category_id: 7, keyword: 'pharmacity', priority: 2 },
  { category_id: 7, keyword: 'long chau', priority: 2 },
  { category_id: 7, keyword: 'an khang', priority: 2 },
  { category_id: 7, keyword: 'benh vien', priority: 2 },
  { category_id: 7, keyword: 'thuoc', priority: 1 },

  // [9: Thu nhập & Nhận tiền]
  { category_id: 9, keyword: 'nhan tien', priority: 2 },
  { category_id: 9, keyword: 'nhận tiền', priority: 2 },
  { category_id: 9, keyword: 'tien vao', priority: 2 },
  { category_id: 9, keyword: 'tiền vào', priority: 2 },
  { category_id: 9, keyword: 'chuyen vao', priority: 2 },
  { category_id: 9, keyword: 'chuyển vào', priority: 2 },
  { category_id: 9, keyword: 'cong tien', priority: 2 },
  { category_id: 9, keyword: 'cộng tiền', priority: 2 },
  { category_id: 9, keyword: 'luong', priority: 2 },
  { category_id: 9, keyword: 'lương', priority: 2 },
  { category_id: 9, keyword: 'hoc bong', priority: 2 },
  { category_id: 9, keyword: 'học bổng', priority: 2 },
  { category_id: 9, keyword: 'cashback', priority: 2 },
  { category_id: 9, keyword: 'hoan tien', priority: 2 },
  { category_id: 9, keyword: 'hoàn tiền', priority: 2 },
  { category_id: 9, keyword: 'me chuyen', priority: 2 },
  { category_id: 9, keyword: 'bo chuyen', priority: 2 },
];
