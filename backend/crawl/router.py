from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from crawl.service import proxy_to_worker
from devices.service import save_batch, search_devices
from history.service import save_history
from schemas import DeviceBatchRequest, SourceEnum
from auth.utils import decode_token
from models import User

router = APIRouter(prefix="/crawl", tags=["crawl"])

class SearchRequest(BaseModel):
    query: str
    num_links: int = 3
    reviews_per_link: int = 50
    platform: str = "shopee"

class LinkRequest(BaseModel):
    url: str
    count: int = 50

def _get_optional_user(request: Request, db: Session) -> Optional[User]:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    try:
        user_id = decode_token(auth.split(" ", 1)[1])
        return db.query(User).filter(User.id == user_id).first()
    except Exception:
        return None

@router.post("/search")
def crawl_search(data: SearchRequest, request: Request, db: Session = Depends(get_db)):
    user = _get_optional_user(request, db)
    existing = search_devices(db, data.query)
    if existing:
        if user:
            for d in existing:
                save_history(db, user.id, d.id, "search", data.query)
        return {"source": "db", "devices": [d.id for d in existing]}
    result = proxy_to_worker("/crawl/search", data.model_dump())
    batch = DeviceBatchRequest(**result, source=SourceEnum.user_search)
    saved = save_batch(db, batch.devices, batch.source)
    if user:
        for d in saved:
            save_history(db, user.id, d.id, "search", data.query)
    return {"source": "crawled", "devices": [d.id for d in saved]}

@router.post("/link")
def crawl_link(data: LinkRequest, request: Request, db: Session = Depends(get_db)):
    from models import Device
    user = _get_optional_user(request, db)
    clean_url = data.url.split("?")[0]
    existing = db.query(Device).filter(Device.product_url == clean_url).first()
    if existing:
        if user:
            save_history(db, user.id, existing.id, "link", data.url)
        return {"source": "db", "devices": [existing.id]}
    result = proxy_to_worker("/crawl/link", data.model_dump())
    batch = DeviceBatchRequest(**result, source=SourceEnum.user_link)
    saved = save_batch(db, batch.devices, batch.source)
    if user:
        for d in saved:
            save_history(db, user.id, d.id, "link", data.url)
    return {"source": "crawled", "devices": [d.id for d in saved]}
