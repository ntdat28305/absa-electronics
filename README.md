# ABSA Tech Reviewer Extension

## Cấu trúc thư mục
```
extension_absa/
├── extension/              ← Load vào Chrome
│   ├── manifest.json
│   ├── popup.html
│   ├── popup.js
│   └── content.js
├── phobert_tokenizer/      ← Tokenizer PhoBERT
├── phobert-base_absa.onnx  ← Model PhoBERT (tự thêm vào)
├── main.py                 ← FastAPI backend
├── requirements.txt
└── README.md
```

## Cách chạy

### 1. Cài thư viện
```bash
pip install -r requirements.txt
```

### 2. Thêm file model PhoBERT
Đặt file `phobert-base_absa.onnx` vào thư mục gốc (cùng cấp với main.py)

### 3. Chạy backend
```bash
uvicorn main:app --reload
```
Server chạy tại: http://127.0.0.1:8000

### 4. Load extension vào Chrome
- Mở Chrome → địa chỉ: `chrome://extensions`
- Bật **Developer mode** (góc trên phải)
- Click **Load unpacked** → chọn thư mục `extension/`

## Mô hình
| Model | Backend | Tốc độ |
|---|---|---|
| PhoBERT | Local ONNX | ~50ms |
| LLaMA 3.2 | HF Space (ntdat232/absa-electronics-api) | ~7s |

## Lưu ý PhoBERT
PhoBERT chạy **hoàn toàn local** — chỉ cần:
- File `phobert-base_absa.onnx`  
- Thư mục `phobert_tokenizer/`  
- **Không cần internet, không cần HF Hub**
