# Local MoMo & Bank Expense Tracker App (Mobile)

Ứng dụng di động quản lý chi tiêu cá nhân hoạt động **hoàn toàn cục bộ (Local SQLite)**, bảo vệ quyền riêng tư 100%, chi phí server bằng 0.

---

## 🌟 Tính năng chính

1. **Tự động hóa thông báo qua MacroDroid & Telegram Bot (Khuyên dùng):**
   - Bắt trọn thông báo biến động số dư từ thanh trạng thái điện thoại (MoMo, Vietcombank, MB Bank, Techcombank, TPBank...) khi thanh toán hoặc nhận tiền.
   - MacroDroid tự động chuyển tiếp tới Telegram Bot cá nhân.
   - App tự động đồng bộ tin nhắn về, bóc tách số tiền và phân loại vào ngân sách.
2. **Dán nhanh thông báo 1 chạm (Quick Paste / Clipboard Auto-Detect):**
   - Tự động nhận diện nội dung thông báo hoặc cú pháp gõ tắt (`35k com tam`, `500k luong`, `1tr me cho`...) từ bộ nhớ tạm để ghi sổ ngay lập tức.
3. **Phân biệt Thu nhập (+) & Chi tiêu (-):**
   - Tiền vào được tự động cộng vào **Số dư khả dụng** và đưa vào danh mục `💰 Thu nhập & Nhận tiền`.
   - Tiền ra tự động trừ vào hạn mức tháng của sinh viên / người đi làm.
4. **Bộ bóc tách Regex thông minh & Tự học danh mục (Self-learning Categorizer):**
   - So khớp đa tầng: Lịch sử đối tác (Counterparty Memory) ➔ Từ khóa ưu tiên tiếng Việt ➔ Danh mục đề xuất.
   - Khi người dùng sửa danh mục, app tự ghi nhớ đối tác và tự học từ khóa mới.
5. **Cảnh báo hạn mức Sinh viên & Phân bổ Thiết yếu vs Phát sinh:**
   - Theo dõi % chi tiêu theo tháng (Ăn uống, Trọ, Điện nước, Xe cộ, Mua sắm, Cafe...).
   - Báo cáo real-time qua Telegram có định dạng HTML an toàn.
6. **Lưu trữ SQLite 100% Offline:**
   - Dữ liệu lưu trực tiếp trên thiết bị của bạn, bảo mật tuyệt đối, không gửi lên bất kỳ server trung gian nào.

---

## 🛠️ Cấu trúc SQLite Database Local

### Bảng `categories`
```sql
CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,                -- Tên danh mục (Ăn uống, Đi lại,...)
    icon TEXT,                         -- Emoji hiển thị
    budget_limit REAL DEFAULT 0,       -- Hạn mức tối đa cho danh mục
    is_essential INTEGER DEFAULT 1     -- 1: Thiết yếu (Cơm, trọ), 0: Phát sinh
);
```

### Bảng `transactions`
```sql
CREATE TABLE transactions (
    id TEXT PRIMARY KEY,               -- Unique Transaction ID / Message ID
    amount REAL NOT NULL,              -- Số tiền (Dương: Thu nhập, Âm: Chi tiêu)
    transaction_time DATETIME NOT NULL,-- Thời gian giao dịch
    description TEXT,                  -- Nội dung / Tên người nhận/chuyển
    category_id INTEGER,               -- Khóa ngoại trỏ tới categories(id)
    is_reviewed INTEGER DEFAULT 0,     -- 1: Đã người dùng duyệt, 0: Máy tự đoán
    raw_payload TEXT,                  -- Nội dung gốc để xem lại
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL
);
```

---

## 🚀 Hướng dẫn cài đặt & khởi chạy

### 1. Cài đặt thư viện
```bash
npm install
```

### 2. Chạy ứng dụng
```bash
# Khởi động Expo dev server
npx expo start

# Hoặc chạy trên Android / Web
npm run android
npm run web
```

### 3. Đóng gói file APK độc lập cho Android (EAS Build)
```bash
npm run build:apk
```

### 4. Chạy kiểm thử tự động (Unit Tests)
```bash
npm test
```

---

## 📱 Cấu hình trong ứng dụng (Mục Cài đặt)

1. **Telegram Bot:**
   - Tạo bot qua [@BotFather](https://t.me/BotFather) để lấy `Bot Token`.
   - Lấy `Chat ID` qua [@userinfobot](https://t.me/userinfobot).
   - Nhấn *"✈️ Kiểm tra kết nối Bot"* để test tin nhắn ngay lập tức.
2. **MacroDroid (Android Automation):**
   - Thiết lập Trigger nhận thông báo MoMo/Bank ➔ Action mở Webhook Telegram đã tạo sẵn trong app.
3. **Quản lý hạn mức:**
   - Nhập ngân sách đầu tháng (ví dụ 3.000.000đ cho sinh viên) và mục tiêu tiết kiệm. App sẽ tự động trừ dần khi chi tiêu và cộng dồn khi có tiền về.
