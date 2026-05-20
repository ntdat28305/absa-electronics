import requests
import uuid
import json

HF_SPACE_BASE = "https://ntdat232-absa-electronics-api.hf.space"


def predict_absa(text: str) -> list[dict]:
    session_hash = uuid.uuid4().hex[:8]
    try:
        resp = requests.post(
            f"{HF_SPACE_BASE}/gradio_api/queue/join",
            json={"data": [text.strip()], "fn_index": 0, "session_hash": session_hash},
            headers={"Content-Type": "application/json"},
            timeout=15,
        )
        resp.raise_for_status()
        event_id = resp.json().get("event_id")
        if not event_id:
            return []
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
                    return []
                raw = payload["output"]["data"][0]
                return [
                    {
                        "aspect": a.get("category", ""),
                        "sentiment": a.get("sentiment", ""),
                        "confidence": None,
                    }
                    for a in (raw if isinstance(raw, list) else [])
                ]
    except Exception as e:
        print(f"[HF Error] {e}")
    return []


def analyze_reviews(texts: list[str]) -> list[list[dict]]:
    results = []
    for text in texts:
        aspects = predict_absa(text)
        results.append(aspects)
    return results
