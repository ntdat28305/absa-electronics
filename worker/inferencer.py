import os
import torch
import numpy as np
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from underthesea import word_tokenize

CATEGORIES = [
    "Battery", "Camera", "Customer_Service", "Design",
    "Feature", "General", "Performance", "Price", "Screen"
]

_model = None
_tokenizer = None


def _load_model():
    global _model, _tokenizer
    if _model is None:
        model_path = os.getenv("MODEL_PATH", "./phobert_model")
        _tokenizer = AutoTokenizer.from_pretrained(model_path)
        _model = AutoModelForSequenceClassification.from_pretrained(
            model_path, num_labels=18, ignore_mismatched_sizes=True
        )
        _model.eval()
        if torch.cuda.is_available():
            _model = _model.cuda()


def predict_absa(text: str) -> list[dict]:
    _load_model()
    segmented = word_tokenize(text, format="text")
    inputs = _tokenizer(
        segmented, return_tensors="pt", truncation=True,
        max_length=256, padding=True
    )
    if torch.cuda.is_available():
        inputs = {k: v.cuda() for k, v in inputs.items()}
    with torch.no_grad():
        logits = _model(**inputs).logits
    probs = torch.sigmoid(logits).squeeze().cpu().numpy()
    results = []
    for idx, cat in enumerate(CATEGORIES):
        neg = float(probs[idx * 2])
        pos = float(probs[idx * 2 + 1])
        if pos > 0.5:
            results.append({"aspect": cat, "sentiment": "Positive", "confidence": pos})
        elif neg > 0.5:
            results.append({"aspect": cat, "sentiment": "Negative", "confidence": neg})
    return results


def analyze_reviews(texts: list[str]) -> list[list[dict]]:
    return [predict_absa(t) for t in texts]
