# DevSense Web — Project Context

## Tổng quan
Web app phân tích cảm xúc bình luận thiết bị điện tử (điện thoại, laptop) theo phong cách sàn TMĐT. Nâng cấp từ Chrome extension ABSA.

## Kiến trúc 3-tier
```
Frontend (React/Vite) → Railway
Main API (FastAPI + PostgreSQL) → Railway  
Colab Worker (crawl Shopee/Tiki + HF inference) → ngrok
Models (PhoBERT + LLaMA ABSA) → HuggingFace Space: ntdat232-absa-electronics-api.hf.space
```

## GitHub repo
https://github.com/ntdat28305/absa-electronics

## Trạng thái hiện tại (2026-05-20)
- [x] Backend FastAPI — HOÀN THÀNH (18 tests passing)
- [x] Frontend React — HOÀN THÀNH (8 trang)
- [x] Colab Worker — HOÀN THÀNH
- [ ] Deploy Railway backend — ĐANG LÀM (đang build)
- [ ] Deploy Railway frontend — CHƯA
- [ ] Pre-crawl ~30-50 thiết bị vào DB

## Cấu trúc thư mục
```
backend/          FastAPI + PostgreSQL
  main.py         entry point
  config.py       Settings (pydantic-settings): DATABASE_URL, SECRET_KEY, WORKER_API_KEY
  models.py       5 ORM models: User, Device, Review, Favorite, AnalysisHistory
  scoring.py      ABSA scoring formula
  auth/           JWT + bcrypt
  devices/        CRUD + batch save
  crawl/          proxy → Colab Worker
  favorites/      JWT protected
  history/        JWT protected
  worker/         register ngrok URL + health check
  tests/          18 tests, all passing
  Dockerfile      Railway deploy
  .env.example    template

frontend/         React 18 + Vite + Tailwind CSS 3
  src/api/        axios clients (auth, devices, crawl, favorites, history)
  src/context/    AuthContext (JWT localStorage)
  src/components/ Navbar, DeviceCard, AspectBadges, AspectProgressBars, RadarChart, ReviewList, WorkerStatus
  src/pages/      Home, DeviceDetail, Search, Analyze, History, Favorites, Login, Register
  Dockerfile      multi-stage nginx
  nginx.conf      SPA fallback

worker/           Google Colab
  app.py          FastAPI: /health, /crawl/search, /crawl/link
  crawler.py      Shopee + Tiki search API + review scrapers
  inferencer.py   HuggingFace Space Gradio SSE client
  scoring.py      same formula as backend
  worker_notebook.ipynb  6-cell Colab setup notebook
```

## Database Schema (PostgreSQL)
- `users`: id, email, password_hash, display_name, created_at
- `devices`: id, name, category(phone/laptop), brand, image_url, platform, product_url, price, overall_score, total_reviews_analyzed, aspect_scores(JSON), crawled_at, source
- `reviews`: id, device_id, text, aspects(JSON), platform, crawled_at
- `favorites`: id, user_id, device_id, saved_at [UNIQUE user+device]
- `analysis_history`: id, user_id, device_id, query_type(search/link/preset), input_query, created_at

## ABSA 9 khía cạnh
Battery, Camera, Customer_Service, Design, Feature, General, Performance, Price, Screen

## Scoring formula
```python
confidence = min(1.0, log(n+1) / log(31))  # n = số reviews
score = (mean_positive_pct * confidence + 50 * (1 - confidence)) / 10
```

## Deploy Railway — Hướng dẫn
### Backend (đang thực hiện)
1. railway.app → New Project → Deploy from GitHub → chọn repo, root `/backend`
2. Add PostgreSQL plugin (DATABASE_URL tự link)
3. Variables cần set:
   - SECRET_KEY: generate bằng `python -c "import secrets; print(secrets.token_hex(32))"`
   - WORKER_API_KEY: `devsense-worker-2024` (hoặc tự đặt)
   - DATABASE_URL: tự động từ PostgreSQL plugin
4. Verify: mở `https://your-url.railway.app/docs`

### Frontend (sau backend)
1. New service trong cùng project → root `/frontend`
2. Variables: `VITE_API_URL=https://[backend-url].railway.app`
3. Build arg trong Dockerfile đã có sẵn ARG VITE_API_URL

## Colab Worker — Cách chạy
1. Upload 4 files lên /content/: app.py, crawler.py, inferencer.py, scoring.py
2. Mở worker_notebook.ipynb trong Colab
3. Cell 3: điền MAIN_API_URL (Railway backend URL) + NGROK_TOKEN (ngrok.com free)
4. Chạy lần lượt từ Cell 1 → Cell 6

## API Endpoints chính
```
POST /auth/register, /auth/login
GET  /auth/me
GET  /devices?category=phone&brand=Apple&sort=score&page=1
GET  /devices/{id}
GET  /devices/search?q=iphone
POST /devices/batch  (worker API key required)
POST /crawl/search {query, num_links, reviews_per_link, platform}
POST /crawl/link {url, count}
GET  /favorites, POST /favorites/{id}, DELETE /favorites/{id}
GET  /history
POST /worker/register {url}
GET  /worker/health
```

## Tech Stack
- Frontend: React 18, Vite, Tailwind CSS 3, recharts, axios, react-router-dom
- Backend: FastAPI 0.111, SQLAlchemy 2.0, alembic, python-jose, passlib[bcrypt], httpx, pydantic-settings
- Worker: FastAPI, pyngrok, selenium, requests
- DB: PostgreSQL (Railway) / SQLite (local dev)

## Notes quan trọng
- bcrypt phải pin `bcrypt==4.0.1` (passlib không tương thích bcrypt>=4.1)
- GET /devices/search phải register TRƯỚC GET /devices/{id} trong router
- Worker URL lưu in-memory trên Main API (mất khi restart Railway → Colab phải re-register)
- crawl/router.py có optional auth workaround — xem backend/crawl/router.py
