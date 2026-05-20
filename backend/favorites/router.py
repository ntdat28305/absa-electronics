from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from auth.service import get_current_user
from models import Favorite, Device
from schemas import DeviceOut

router = APIRouter(prefix="/favorites", tags=["favorites"])

@router.get("", response_model=list[DeviceOut])
def get_favorites(db: Session = Depends(get_db), user=Depends(get_current_user)):
    favs = db.query(Favorite).filter(Favorite.user_id == user.id).all()
    device_ids = [f.device_id for f in favs]
    if not device_ids:
        return []
    devices = db.query(Device).filter(Device.id.in_(device_ids)).all()
    return [DeviceOut.model_validate(d) for d in devices]

@router.post("/{device_id}")
def add_favorite(device_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if not db.query(Device).filter(Device.id == device_id).first():
        raise HTTPException(status_code=404, detail="Thiết bị không tồn tại")
    existing = db.query(Favorite).filter(Favorite.user_id == user.id, Favorite.device_id == device_id).first()
    if existing:
        return {"status": "already_saved"}
    db.add(Favorite(user_id=user.id, device_id=device_id))
    db.commit()
    return {"status": "saved"}

@router.delete("/{device_id}")
def remove_favorite(device_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    fav = db.query(Favorite).filter(Favorite.user_id == user.id, Favorite.device_id == device_id).first()
    if not fav:
        raise HTTPException(status_code=404, detail="Không có trong ưu thích")
    db.delete(fav)
    db.commit()
    return {"status": "removed"}
