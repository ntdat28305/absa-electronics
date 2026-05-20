from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from crawl.service import proxy_to_worker
from devices.service import save_batch, search_devices
from schemas import DeviceBatchRequest, SourceEnum

router = APIRouter(prefix="/crawl", tags=["crawl"])

class SearchRequest(BaseModel):
    query: str
    num_links: int = 3
    reviews_per_link: int = 50
    platform: str = "shopee"

class LinkRequest(BaseModel):
    url: str
    count: int = 50

@router.post("/search")
def crawl_search(data: SearchRequest, db: Session = Depends(get_db)):
    # Check DB first
    existing = search_devices(db, data.query)
    if existing:
        return {"source": "db", "devices": [d.id for d in existing]}
    # Crawl via worker
    result = proxy_to_worker("/crawl/search", data.model_dump())
    batch = DeviceBatchRequest(**result, source=SourceEnum.user_search)
    saved = save_batch(db, batch.devices, batch.source)
    return {"source": "crawled", "devices": [d.id for d in saved]}

@router.post("/link")
def crawl_link(data: LinkRequest, db: Session = Depends(get_db)):
    result = proxy_to_worker("/crawl/link", data.model_dump())
    batch = DeviceBatchRequest(**result, source=SourceEnum.user_link)
    saved = save_batch(db, batch.devices, batch.source)
    return {"source": "crawled", "devices": [d.id for d in saved]}
