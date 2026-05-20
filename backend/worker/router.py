from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from worker.state import set_worker_url, get_worker_url
from config import settings
import httpx

router = APIRouter(prefix="/worker", tags=["worker"])

class RegisterRequest(BaseModel):
    url: str

@router.post("/register")
def register_worker(data: RegisterRequest, x_worker_key: str = Header(...)):
    if x_worker_key != settings.worker_api_key:
        raise HTTPException(status_code=403, detail="Invalid worker key")
    set_worker_url(data.url)
    return {"status": "registered", "url": data.url}

@router.get("/health")
def worker_health():
    url = get_worker_url()
    if not url:
        return {"online": False, "reason": "Worker chưa đăng ký URL"}
    try:
        r = httpx.get(f"{url}/health", timeout=5)
        return {"online": r.status_code == 200, "url": url}
    except Exception:
        return {"online": False, "url": url}
