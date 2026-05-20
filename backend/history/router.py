from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from database import get_db
from auth.service import get_current_user
from history.service import get_history

router = APIRouter(prefix="/history", tags=["history"])

class HistoryOut(BaseModel):
    id: int
    device_id: Optional[int] = None
    query_type: str
    input_query: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}

@router.get("")
def get_user_history(page: int = 1, db: Session = Depends(get_db), user=Depends(get_current_user)):
    items, total = get_history(db, user.id, page)
    return {"total": total, "page": page, "items": [HistoryOut.model_validate(h) for h in items]}
