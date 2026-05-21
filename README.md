# DevSense Web — Phân tích cảm xúc bình luận thiết bị điện tử

Web app phân tích ABSA (Aspect-Based Sentiment Analysis) bình luận điện thoại và laptop từ Tiki/Shopee, xây dựng trên nền tảng sàn TMĐT.

## Kiến trúc

```
Frontend (React/Vite)  →  Railway
Main API (FastAPI + PostgreSQL)  →  Railway
Local Worker (FastAPI + ngrok)  →  máy cá nhân
Models (PhoBERT ABSA)  →  chạy local trên worker
```

## Tính năng

- **Trang chủ**: Kho thiết bị đã phân tích, lọc theo danh mục/thương hiệu/điểm
- **Tìm kiếm**: Crawl trực tiếp từ Tiki hoặc Shopee theo từ khóa
- **Phân tích link**: Dán link sản phẩm Tiki/Shopee → tự động crawl & phân tích
- **Radar chart + aspect bars**: Hiển thị điểm 9 khía cạnh (Battery, Camera, Design, ...)
- **Lịch sử & Yêu thích**: Lưu lại các lần phân tích, bookmark sản phẩm
- **Đăng nhập / Đăng ký**: JWT auth

## Cấu trúc thư mục

```
backend/          FastAPI + PostgreSQL (Railway)
frontend/         React 18 + Vite + Tailwind CSS (Railway)
worker/           Local worker: crawl Tiki/Shopee + PhoBERT inference
  app.py
  crawler.py
  inferencer.py
  scoring.py
  start_worker.py
  worker_notebook.ipynb   (Colab fallback)
```

## Chạy local worker

### Yêu cầu
- Python 3.10+
- Google Chrome (version 148)
- File model: `worker/phobert_model/` (không commit lên git)

### Cài đặt
```bash
cd worker
pip install -r requirements.txt
```

### Tạo file `.env`
```
WORKER_API_KEY=devsense-worker-2024
MODEL_PATH=./phobert_model
MAIN_API_URL=https://<backend>.railway.app
NGROK_TOKEN=<your_ngrok_token>
PORT=8001
SHOPEE_COOKIE=<cookie_từ_browser>
```

### Chạy
```bash
python start_worker.py
```

Worker tự đăng ký URL ngrok với backend Railway.

## 9 khía cạnh ABSA

Battery · Camera · Customer_Service · Design · Feature · General · Performance · Price · Screen

## Scoring formula

```python
confidence = min(1.0, log(n+1) / log(31))   # n = số reviews
score = (mean_positive_pct * confidence + 50 * (1 - confidence)) / 10
```

## Deploy

| Service | Platform | Ghi chú |
|---|---|---|
| Backend | Railway | PostgreSQL plugin đính kèm |
| Frontend | Railway | Build arg: `VITE_API_URL` |
| Worker | Local + ngrok | Cần chạy thủ công, re-register khi restart |

## Lưu ý

- `worker/phobert_model/` và `worker/.env` không được commit (có trong `.gitignore`)
- Shopee cookie hết hạn sau vài ngày — cần cập nhật thủ công trong `.env`
- Home page chỉ hiển thị thiết bị có `source = 'db_preset'`; crawl mới lưu với source khác
