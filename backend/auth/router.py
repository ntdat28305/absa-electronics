from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from auth.service import register, login, get_current_user
from auth.utils import create_token
from schemas import UserRegister, UserLogin, Token, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=Token)
def register_route(data: UserRegister, db: Session = Depends(get_db)):
    user = register(data, db)
    return Token(access_token=create_token(user.id), user=UserOut.model_validate(user))

@router.post("/login", response_model=Token)
def login_route(data: UserLogin, db: Session = Depends(get_db)):
    token, user = login(data, db)
    return Token(access_token=token, user=UserOut.model_validate(user))

@router.get("/me", response_model=UserOut)
def me_route(user=Depends(get_current_user)):
    return user
