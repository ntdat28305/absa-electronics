from sqlalchemy.orm import Session
from models import AnalysisHistory, QueryTypeEnum

def save_history(db: Session, user_id: int, device_id: int, query_type: str, input_query: str):
    h = AnalysisHistory(user_id=user_id, device_id=device_id,
                        query_type=QueryTypeEnum(query_type), input_query=input_query)
    db.add(h)
    db.commit()

def get_history(db: Session, user_id: int, page: int = 1, limit: int = 20):
    q = db.query(AnalysisHistory).filter(AnalysisHistory.user_id == user_id)\
          .order_by(AnalysisHistory.created_at.desc())
    total = q.count()
    items = q.offset((page - 1) * limit).limit(limit).all()
    return items, total
