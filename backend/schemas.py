from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional, Any
from models import CategoryEnum, PlatformEnum, SourceEnum

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    display_name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: int
    email: str
    display_name: str
    created_at: datetime
    model_config = {"from_attributes": True}

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
