from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import onnxruntime as ort
from transformers import PhobertTokenizer
import numpy as np
from underthesea import word_tokenize
import requests
import json
import os
import uuid

app = FastAPI(title="ABSA Tech Review API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────
CATEGORIES = [
    "Battery", "Camera", "Customer_Service", "Design",
    "Feature", "General", "Performance", "Price", "Screen"
]
LABELS = []
for cat in CATEGORIES:
    LABELS.append((cat, "Negative"))
    LABELS.append((cat, "Positive"))

# HF Space chạy model LLaMA đã fine-tune
HF_SPACE_BASE = "https://ntdat232-absa-electronics-api.hf.space"

# ─────────────────────────────────────────────────────────────
# PHOBERT — Load ONNX (local, không cần internet)
# ─────────────────────────────────────────────────────────────
phobert_tokenizer = PhobertTokenizer(
    vocab_file="./phobert_tokenizer/vocab.txt",
    merges_file="./phobert_tokenizer/bpe.codes",
)
session = ort.InferenceSession("phobert-base_absa.onnx")
print("✅ PhoBERT ONNX loaded")


def predict_phobert(text: str) -> list:
    segmented = word_tokenize(text, format="text")
    inputs = phobert_tokenizer(
        segmented,
        return_tensors="np",
        padding="max_length",
        truncation=True,
        max_length=256,
    )
    onnx_inputs = {
        "input_ids": inputs["input_ids"].astype(np.int64),
        "attention_mask": inputs["attention_mask"].astype(np.int64),
    }
    outputs = session.run(None, onnx_inputs)
    logits = outputs[0][0]
    probs = 1 / (1 + np.exp(-logits))
    active_indices = np.where(probs > 0.5)[0]

    results = []
    for idx in active_indices:
        aspect, sentiment = LABELS[idx]
        results.append({
            "aspect": aspect,
            "sentiment": sentiment,
            "confidence": round(float(probs[idx]), 4),
        })

    # Fallback nếu không có nhãn nào vượt threshold
    if not results:
        idx = int(np.argmax(probs))
        aspect, sentiment = LABELS[idx]
        results.append({
            "aspect": aspect,
            "sentiment": sentiment,
            "confidence": round(float(probs[idx]), 4),
        })

    return results


# ─────────────────────────────────────────────────────────────
# LLAMA — Gradio 5 Queue API (gọi HF Space)
# ─────────────────────────────────────────────────────────────
def predict_llama(text: str) -> list:
    session_hash = uuid.uuid4().hex[:8]

    try:
        # Bước 1: Submit vào queue
        resp = requests.post(
            f"{HF_SPACE_BASE}/gradio_api/queue/join",
            json={
                "data": [text.strip()],
                "fn_index": 0,
                "session_hash": session_hash,
            },
            headers={"Content-Type": "application/json"},
            timeout=15,
        )
        resp.raise_for_status()
        event_id = resp.json().get("event_id")
        if not event_id:
            print("[LLaMA] Không lấy được event_id")
            return []

        # Bước 2: Stream kết quả
        stream = requests.get(
            f"{HF_SPACE_BASE}/gradio_api/queue/data",
            params={"session_hash": session_hash},
            stream=True,
            timeout=120,
        )

        for line in stream.iter_lines():
            if not line:
                continue
            decoded = line.decode("utf-8")
            if not decoded.startswith("data:"):
                continue
            payload = json.loads(decoded[5:].strip())

            if payload.get("msg") == "process_completed":
                if not payload.get("success"):
                    print(f"[LLaMA] Lỗi Space: {payload}")
                    return []
                raw_data = payload["output"]["data"][0]
                return [
                    {
                        "aspect": a.get("category", ""),
                        "sentiment": a.get("sentiment", ""),
                        "confidence": None,
                    }
                    for a in raw_data
                    if a.get("category") in CATEGORIES
                ]

    except Exception as e:
        print(f"[LLaMA Space Error] {e}")

    return []


# ─────────────────────────────────────────────────────────────
# SCHEMA & ENDPOINTS
# ─────────────────────────────────────────────────────────────
class ReviewInput(BaseModel):
    reviews: List[str]
    model_type: Optional[str] = "phobert"  # "phobert" | "llama"


@app.post("/predict")
async def predict_reviews(data: ReviewInput):
    use_llama = data.model_type.strip().lower() == "llama"
    results = []

    for text in data.reviews:
        if not text or str(text).strip() == "":
            continue
        try:
            aspects = predict_llama(text) if use_llama else predict_phobert(text)
            results.append({
                "text": text,
                "model": data.model_type,
                "predicted_aspect": aspects[0]["aspect"] if aspects else "Không xác định",
                "predicted_sentiment": aspects[0]["sentiment"] if aspects else None,
                "all_aspects": aspects,
            })
        except Exception as e:
            print(f"[LỖI] '{text[:50]}': {e}")
            results.append({
                "text": text,
                "model": data.model_type,
                "predicted_aspect": "Lỗi dữ liệu",
                "predicted_sentiment": None,
                "all_aspects": [],
            })

    return {"status": "success", "model": data.model_type, "data": results}


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "models": ["phobert", "llama"],
        "phobert": "local ONNX",
        "llama": HF_SPACE_BASE,
    }
