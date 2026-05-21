# DevSense Web — Project Context

## Tổng quan
Web app phân tích cảm xúc bình luận thiết bị điện tử (điện thoại, laptop) theo phong cách sàn TMĐT. Nâng cấp từ Chrome extension ABSA.

## Kiến trúc 3-tier
```
Frontend (React/Vite) → Vercel
Main API (FastAPI + PostgreSQL) → Railway
Local Worker (crawl Shopee/Tiki + PhoBERT inference) → ngrok (máy cá nhân)
```

**Lưu ý:** Worker chạy local, KHÔNG dùng HuggingFace Space hay Colab nữa. PhoBERT inference chạy trực tiếp trên máy từ `./phobert_model`.

## GitHub repo
https://github.com/ntdat28305/absa-electronics

## Trạng thái hiện tại (2026-05-21)
- [x] Backend FastAPI — HOÀN THÀNH (Railway)
- [x] Frontend React — HOÀN THÀNH (Vercel)
- [x] Local Worker — HOÀN THÀNH (chạy local + ngrok)
- [x] Tiki crawl — HOẠT ĐỘNG ổn định
- [x] Shopee crawl — HOẠT ĐỘNG (undetected_chromedriver, cần login cookie)
- [x] DB đã có data (~10+ thiết bị, source=db_preset)

## Cấu trúc thư mục
```
backend/          FastAPI + PostgreSQL
  main.py         entry point
  config.py       Settings (pydantic-settings): DATABASE_URL, SECRET_KEY, WORKER_API_KEY
  models.py       5 ORM models: User, Device, Review, Favorite, AnalysisHistory
  scoring.py      ABSA scoring formula
  auth/           JWT + bcrypt
  devices/        CRUD + batch save (upsert by product_url)
  crawl/          proxy → Local Worker (always re-crawl, no DB cache)
  favorites/      JWT protected
  history/        JWT protected
  worker/         register ngrok URL + health check
  tests/          18 tests, all passing
  Dockerfile      Railway deploy
  .env.example    template

frontend/         React 18 + Vite + Tailwind CSS 3
  src/api/        axios clients (auth, devices, crawl, favorites, history)
  src/context/    AuthContext (JWT localStorage)
  src/components/ Navbar, DeviceCard, DeviceCardSkeleton, AspectBadges, AspectProgressBars, RadarChart, ReviewList, WorkerStatus
  src/pages/      Home, DeviceDetail, Search, Analyze, History, Favorites, Login, Register
  Dockerfile      multi-stage nginx
  nginx.conf      SPA fallback

worker/           Local machine
  app.py          FastAPI: /health, /crawl/search, /crawl/link
  crawler.py      Shopee (undetected_chromedriver) + Tiki (requests) scrapers
  inferencer.py   PhoBERT local inference từ ./phobert_model
  scoring.py      same formula as backend
  start_worker.py ngrok tunnel + auto-register với backend + uvicorn
  worker_notebook.ipynb  Colab fallback (legacy)
  .env            secrets (không commit)
  phobert_model/  model files (không commit)
```

## Database Schema (PostgreSQL)
- `users`: id, email, password_hash, display_name, created_at
- `devices`: id, name, category(phone/laptop), brand, image_url, platform, product_url, price, overall_score, total_reviews_analyzed, aspect_scores(JSON), crawled_at, source(SourceEnum)
- `reviews`: id, device_id, text, aspects(JSON), platform, crawled_at
- `favorites`: id, user_id, device_id, saved_at [UNIQUE user+device]
- `analysis_history`: id, user_id, device_id, query_type(search/link/preset), input_query, created_at

## SourceEnum
- `db_preset` — thiết bị trong kho (hiện trên Home page)
- `user_search` — crawl từ tính năng Search
- `user_link` — crawl từ tính năng Phân tích link

**Home page chỉ hiện `source=db_preset`.** Search/Analyze lưu DB nhưng không ra Home.

## ABSA 9 khía cạnh
Battery, Camera, Customer_Service, Design, Feature, General, Performance, Price, Screen

## Scoring formula
```python
confidence = min(1.0, log(n+1) / log(31))  # n = số reviews
score = (mean_positive_pct * confidence + 50 * (1 - confidence)) / 10
```

## Local Worker — Cách chạy
1. Tạo `worker/.env` với các biến: WORKER_API_KEY, MODEL_PATH, MAIN_API_URL, NGROK_TOKEN, PORT, SHOPEE_COOKIE
2. `cd worker && python start_worker.py`
3. Worker tự mở ngrok tunnel và đăng ký với Railway backend

## API Endpoints chính
```
POST /auth/register, /auth/login
GET  /auth/me
GET  /devices?category=phone&brand=Apple&sort=score&page=1&source=db_preset
GET  /devices/{id}
GET  /devices/search?q=iphone
POST /crawl/search {query, num_links, reviews_per_link, platform, force_crawl}
POST /crawl/link {url, count}
GET  /favorites, POST /favorites/{id}, DELETE /favorites/{id}
GET  /history
POST /worker/register {url}
GET  /worker/health
```

## Tech Stack
- Frontend: React 18, Vite, Tailwind CSS 3, recharts, lucide-react, axios, react-router-dom
- Backend: FastAPI 0.111, SQLAlchemy 2.0, alembic, python-jose, passlib[bcrypt], httpx, pydantic-settings
- Worker: FastAPI, pyngrok, undetected-chromedriver, torch, transformers, underthesea
- DB: PostgreSQL (Railway) / SQLite (local dev)

## Notes quan trọng
- bcrypt phải pin `bcrypt==4.0.1` (passlib không tương thích bcrypt>=4.1)
- GET /devices/search phải register TRƯỚC GET /devices/{id} trong router
- Worker URL lưu in-memory trên Main API → mất khi restart Railway, worker phải re-register
- Shopee cookie hết hạn sau vài ngày → cập nhật SHOPEE_COOKIE trong worker/.env
- Shopee dùng undetected_chromedriver version_main=148, headless=False
- Khi Shopee hiện /verify/ page → worker chờ user xử lý thủ công trong cửa sổ Chrome
- Search crawl tối đa 20 candidates để đảm bảo trả đủ num_links sản phẩm có review
- save_batch upsert theo product_url (cập nhật score/reviews nếu đã tồn tại)
- ngrok-skip-browser-warning: 1 header bắt buộc trong mọi request backend → worker
