import httpx
from fastapi import HTTPException
from worker.state import get_worker_url
from config import settings

def proxy_to_worker(endpoint: str, payload: dict) -> dict:
    url = get_worker_url()
    if not url:
        raise HTTPException(status_code=503, detail="Worker đang offline. Vui lòng khởi động Colab.")
    try:
        r = httpx.post(f"{url}{endpoint}", json=payload,
                       headers={"x-worker-key": settings.worker_api_key,
                                "ngrok-skip-browser-warning": "1"}, timeout=300)
        r.raise_for_status()
        return r.json()
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Worker timeout. Thử lại với số reviews ít hơn.")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Worker error: {e.response.text}")
