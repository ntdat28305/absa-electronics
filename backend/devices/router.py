from fastapi import APIRouter, Depends, Query, Header, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from config import settings
from devices.service import list_devices, get_device, search_devices, save_batch
from schemas import DeviceOut, DeviceDetail, DeviceBatchRequest, ReviewOut

router = APIRouter(prefix="/devices", tags=["devices"])

@router.get("", response_model=dict)
def get_devices(category: Optional[str] = None, brand: Optional[str] = None,
                sort: str = "score", page: int = 1, db: Session = Depends(get_db)):
    items, total = list_devices(db, category, brand, sort, page)
    return {"total": total, "page": page, "items": [DeviceOut.model_validate(d) for d in items]}

@router.get("/search", response_model=list[DeviceOut])
def search(q: str = Query(..., min_length=1), db: Session = Depends(get_db)):
    return [DeviceOut.model_validate(d) for d in search_devices(db, q)]

@router.get("/{device_id}", response_model=DeviceDetail)
def get_one(device_id: int, db: Session = Depends(get_db)):
    device, reviews = get_device(db, device_id)
    result = DeviceDetail.model_validate(device)
    result.reviews = [ReviewOut.model_validate(r) for r in reviews]
    return result

@router.post("/batch", response_model=list[DeviceOut])
def batch_save(data: DeviceBatchRequest, x_worker_key: str = Header(...),
               db: Session = Depends(get_db)):
    if x_worker_key != settings.worker_api_key:
        raise HTTPException(status_code=403, detail="Invalid worker API key")
    saved = save_batch(db, data.devices, data.source)
    return [DeviceOut.model_validate(d) for d in saved]

@router.delete("/cleanup", response_model=dict)
def cleanup_empty(x_worker_key: str = Header(...), db: Session = Depends(get_db)):
    """Xóa các thiết bị bị crawl lỗi (0 reviews hoặc tên mặc định)."""
    if x_worker_key != settings.worker_api_key:
        raise HTTPException(status_code=403, detail="Invalid worker API key")
    from models import Review, Device
    bad = db.query(Device).filter(
        (Device.total_reviews_analyzed == 0) |
        (Device.name.like("Sản phẩm Tiki #%")) |
        (Device.name.like("Sản phẩm Shopee #%"))
    ).all()
    count = len(bad)
    for d in bad:
        db.query(Review).filter(Review.device_id == d.id).delete()
        db.delete(d)
    db.commit()
    return {"deleted": count}
