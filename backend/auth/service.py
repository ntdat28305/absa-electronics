from sqlalchemy.orm import Session
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from models import User
from database import get_db
from auth.utils import hash_password, verify_password, create_token, decode_token
from schemas import UserRegister, UserLogin

bearer = HTTPBearer()

def register(data: UserRegister, db: Session) -> User:
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email đã được sử dụng")
    user = User(email=data.email, password_hash=hash_password(data.password), display_name=data.display_name)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def login(data: UserLogin, db: Session) -> tuple:
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không đúng")
    return create_token(user.id), user

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)) -> User:
    try:
        user_id = decode_token(credentials.credentials)
    except Exception:
        raise HTTPException(status_code=401, detail="Token không hợp lệ")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User không tồn tại")
    return user
