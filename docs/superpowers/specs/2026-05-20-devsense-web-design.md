# DevSense Web — Design Spec
_Date: 2026-05-20_

## Overview

Nâng cấp từ Chrome extension ABSA đơn giản thành web app phân tích cảm xúc bình luận thiết bị điện tử (điện thoại, laptop) theo phong cách sàn thương mại điện tử. Người dùng có thể xem kho thiết bị đã phân tích sẵn, tìm kiếm thiết bị mới (crawl theo từ khóa), dán link sản phẩm để phân tích trực tiếp, lưu ưu thích, và xem lịch sử phân tích.

---

## 1. Architecture

### 4 thành phần

| Layer | Tech | Deploy |
|---|---|---|
| Frontend | React + Vite + Tailwind CSS | Railway |
| Main API | FastAPI + PostgreSQL | Railway |
| Crawl Worker | FastAPI + Selenium + ngrok | Google Colab / Local |
| Model Inference | PhoBERT + LLaMA ABSA | HuggingFace Space |

### Data Flow

**Xem kho DB:**
```
Frontend → GET /devices → Main API → PostgreSQL → response
```

**Tìm kiếm (không có trong DB):**
```
Frontend → POST /crawl/search {query, num_links, reviews_per_link, platform}
→ Main API → proxy → Colab Worker
→ Worker: search Shopee/Tiki API → lấy N product links + ảnh + giá
→ Worker: crawl M reviews/link (Selenium)
→ Worker: gọi HuggingFace Space API → ABSA inference
→ Worker: POST /devices lên Main API → lưu PostgreSQL
→ Main API → trả kết quả về Frontend
```

**Dán link:**
```
Frontend → POST /crawl/link {url, count}
→ Main API → proxy → Colab Worker
→ Worker: crawl reviews → HF inference → lưu DB → trả kết quả
```

**Ưu thích / Lịch sử:**
```
Frontend → Main API → PostgreSQL (yêu cầu JWT)
```

**Colab Worker khởi động:**
```
Colab start → ngrok tunnel → POST /worker/register {url} → Main API lưu URL mới
```

**Colab Worker offline:**
```
Main API kiểm tra /health trước mỗi crawl request
→ Offline: trả lỗi rõ ràng "Worker đang offline, vui lòng khởi động Colab"
→ Các tính năng chỉ đọc DB vẫn hoạt động bình thường
```

---

## 2. Database Schema (PostgreSQL)

```sql
-- Tài khoản người dùng
users (
  id, email, password_hash, display_name, created_at
)

-- Kho thiết bị (cào sẵn + kết quả search + kết quả link)
devices (
  id, name, category ENUM(phone, laptop), brand,
  image_url, platform ENUM(shopee, tiki, both),
  product_url, price,
  overall_score FLOAT,           -- tính từ aspect_scores
  total_reviews_analyzed INT,
  aspect_scores JSONB,           -- {Battery: 82, Camera: 45, Performance: 91, ...}
  crawled_at TIMESTAMP,
  source ENUM(db_preset, user_search, user_link)
)

-- Bình luận gốc kèm nhãn ABSA
reviews (
  id, device_id FK, text,
  aspects JSONB,                 -- [{aspect: "Battery", sentiment: "Positive", confidence: 0.91}]
  platform, crawled_at
)

-- Ưu thích
favorites (
  id, user_id FK, device_id FK, saved_at
  UNIQUE(user_id, device_id)
)

-- Lịch sử phân tích
analysis_history (
  id, user_id FK NOT NULL,       -- chỉ lưu khi đã đăng nhập
  device_id FK,
  query_type ENUM(search, link, preset),
  input_query TEXT,              -- từ khóa hoặc URL gốc
  created_at TIMESTAMP
)
```

**ABSA Categories (9 khía cạnh):**
`Battery, Camera, Customer_Service, Design, Feature, General, Performance, Price, Screen`

**overall_score formula:**
```
confidence = min(1.0, log(n + 1) / log(31))   # n = tổng số reviews
mean_positive_pct = mean(% Positive của các aspect có ít nhất 1 review)
overall_score = (mean_positive_pct * confidence + 50 * (1 - confidence)) / 10
```
- `log(31)` chọn để 30 reviews trở lên đạt confidence = 1.0
- `50` là prior trung lập (sản phẩm chưa đủ dữ liệu giả định 50% positive)
- Ví dụ: 2 reviews, 100% positive → score 7.15 (thay vì 10); 30 reviews, 85% positive → score 8.5

---

## 3. Pages & UI

Navigation: Navbar cố định với tabs: **Kho DB | Tìm kiếm | Phân tích link | Lịch sử** + nút Login/Avatar phải.

### 3.1 Kho thiết bị (trang chủ `/`)
- Grid sản phẩm kiểu TMĐT — ảnh, tên, giá, overall score, badge khía cạnh nổi bật
- Filter sidebar: Danh mục (Điện thoại/Laptop), Hãng, Sort (Điểm cao nhất/Mới nhất)
- Button ♡ Ưu thích trên mỗi card (cần đăng nhập)

### 3.2 Chi tiết sản phẩm (`/devices/:id`)
- Header: ảnh sản phẩm + tên + giá + overall score + link mua hàng gốc
- Radar chart mini + progress bars cho 9 khía cạnh (% Positive)
- Review list có filter theo aspect + sentiment, hiển thị confidence
- Button ♡ Ưu thích

### 3.3 Tìm kiếm (`/search`)
- Thanh tìm kiếm lớn
- Nếu có trong DB → hiển thị kết quả ngay
- Nếu không có → form crawl mới:
  - **Từ khóa** (đã nhập)
  - **Số link sản phẩm cần lấy** (1–10, default 3)
  - **Số reviews mỗi sản phẩm** (10–200, default 50)
  - **Nền tảng**: Shopee | Tiki | Cả hai
- Progress bar crawl real-time
- Kết quả: N sản phẩm với đầy đủ phân tích + link mua

### 3.4 Phân tích link (`/analyze`)
- Input dán URL sản phẩm Shopee hoặc Tiki
- Chọn số reviews cần cào (10–200, default 50)
- Kết quả: phân tích đầy đủ + lưu vào DB + lưu lịch sử

### 3.5 Lịch sử (`/history`) — yêu cầu đăng nhập
- Timeline các lần phân tích: icon loại (search/link), từ khóa/URL, ngày giờ, điểm
- Click → xem lại chi tiết sản phẩm

### 3.6 Ưu thích (`/favorites`) — yêu cầu đăng nhập
- Grid giống trang chủ, chỉ hiện thiết bị đã lưu
- Button xóa khỏi ưu thích

### 3.7 Auth (`/login`, `/register`)
- Form đăng ký: email, password, display name
- Form đăng nhập: email, password
- JWT token lưu localStorage
- Redirect về trang trước sau khi đăng nhập

---

## 4. API Endpoints (Main API — Railway)

```
# Auth
POST   /auth/register              body: {email, password, display_name}
POST   /auth/login                 body: {email, password} → {token}
GET    /auth/me                    header: Bearer token

# Devices
GET    /devices                    ?category=phone&brand=Apple&sort=score&page=1
GET    /devices/{id}               chi tiết + reviews
GET    /devices/search?q=...       tìm trong DB

# Crawl (proxy → Colab Worker)
POST   /crawl/search               {query, num_links, reviews_per_link, platform}
POST   /crawl/link                 {url, count}

# Favorites (JWT required)
GET    /favorites
POST   /favorites/{device_id}
DELETE /favorites/{device_id}

# History (JWT required)
GET    /history                    ?page=1

# Internal — Worker gọi để lưu kết quả crawl
POST   /devices/batch              {devices: [...], reviews: [...]} — Worker API key

# Worker management
POST   /worker/register            {url} — Colab gọi khi khởi động
GET    /worker/health              Main API kiểm tra worker còn sống
```

---

## 5. Colab Worker

**Notebook structure:**
```python
# Cell 1: Install
!pip install fastapi uvicorn pyngrok selenium requests transformers

# Cell 2: FastAPI app với 2 endpoints: POST /crawl, GET /health

# Cell 3: Crawl logic
# - Search Shopee/Tiki API (requests, không cần Selenium)
# - Scrape reviews (Selenium)

# Cell 4: ABSA inference
# - Gọi HuggingFace Space API (PhoBERT hoặc LLaMA)

# Cell 5: Start server + ngrok + register URL lên Railway
```

**Hai endpoint của Worker:**
```
POST /crawl    {query/url, num_links, reviews_per_link, platform}
               → trả {devices: [...], reviews: [...]}
GET  /health   → {status: "ok"}
```

---

## 6. Auth & Security

- Password: bcrypt hash
- Auth: JWT (HS256), expire 7 ngày
- Protected routes: `/favorites`, `/history`, `/auth/me`
- Ưu thích/lịch sử không cần login để xem kết quả phân tích — chỉ cần login để lưu

---

## 7. Scope & Phân bổ công việc

### Trong scope
- 7 trang frontend
- Main API đầy đủ endpoints
- Colab Worker notebook (crawl Shopee + Tiki + HF inference)
- PostgreSQL schema + migration
- Auth (register/login/JWT)
- Ưu thích + Lịch sử
- Pre-crawl ~30-50 thiết bị (10-15 phone + 10-15 laptop) cho DB ban đầu
- Deploy Frontend + Main API lên Railway

### Ngoài scope (làm sau)
- So sánh 2 sản phẩm cạnh nhau
- Thông báo / notification
- Admin panel quản lý DB
- OAuth Google

---

## 8. Tech Stack Summary

```
Frontend:   React 18 + Vite + Tailwind CSS + Recharts (radar/bar chart) + Axios
Main API:   FastAPI + SQLAlchemy + PostgreSQL + python-jose (JWT) + bcrypt
Worker:     FastAPI + Selenium + requests + transformers + pyngrok
Models:     PhoBERT ONNX (HF Space) + LLaMA 3.2 (HF Space)
Deploy:     Railway (Frontend + Main API + PostgreSQL)
```
