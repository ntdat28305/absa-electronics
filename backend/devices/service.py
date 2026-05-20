from sqlalchemy.orm import Session
from models import Device, Review, SourceEnum
from scoring import compute_aspect_scores, compute_overall_score
from schemas import DeviceBatchItem

def list_devices(db: Session, category=None, brand=None, sort="score", page=1, limit=20):
    q = db.query(Device).filter(Device.total_reviews_analyzed > 0)
    if category:
        q = q.filter(Device.category == category)
    if brand:
        q = q.filter(Device.brand == brand)
    if sort == "score":
        q = q.order_by(Device.overall_score.desc())
    else:
        q = q.order_by(Device.crawled_at.desc())
    total = q.count()
    items = q.offset((page - 1) * limit).limit(limit).all()
    return items, total

def get_device(db: Session, device_id: int):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Không tìm thấy thiết bị")
    reviews = db.query(Review).filter(Review.device_id == device_id).limit(100).all()
    return device, reviews

def search_devices(db: Session, q: str):
    return db.query(Device).filter(Device.name.ilike(f"%{q}%")).limit(10).all()

def save_batch(db: Session, devices: list[DeviceBatchItem], source: SourceEnum):
    saved = []
    for d in devices:
        aspect_scores = compute_aspect_scores([r.get("aspects", []) for r in d.reviews])
        overall = compute_overall_score(aspect_scores, len(d.reviews))
        device = Device(
            name=d.name, category=d.category, brand=d.brand,
            image_url=d.image_url, platform=d.platform,
            product_url=d.product_url, price=d.price,
            overall_score=overall, total_reviews_analyzed=len(d.reviews),
            aspect_scores=aspect_scores, source=source,
        )
        db.add(device)
        db.flush()
        for r in d.reviews:
            db.add(Review(device_id=device.id, text=r["text"], aspects=r.get("aspects", []), platform=str(d.platform)))
        saved.append(device)
    db.commit()
    for device in saved:
        db.refresh(device)
    return saved
