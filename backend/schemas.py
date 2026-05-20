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

class DeviceOut(BaseModel):
    id: int
    name: str
    category: CategoryEnum
    brand: str
    image_url: Optional[str] = None
    platform: Optional[PlatformEnum] = None
    product_url: Optional[str] = None
    price: Optional[str] = None
    overall_score: float
    total_reviews_analyzed: int
    aspect_scores: Any = {}
    source: SourceEnum
    model_config = {"from_attributes": True}

class ReviewOut(BaseModel):
    id: int
    text: str
    aspects: Any = []
    platform: Optional[str] = None
    model_config = {"from_attributes": True}

class DeviceDetail(DeviceOut):
    reviews: list[ReviewOut] = []

class DeviceBatchItem(BaseModel):
    name: str
    category: CategoryEnum
    brand: str
    image_url: Optional[str] = None
    platform: PlatformEnum
    product_url: str
    price: Optional[str] = None
    reviews: list[dict] = []

class DeviceBatchRequest(BaseModel):
    devices: list[DeviceBatchItem]
    source: SourceEnum = SourceEnum.user_search
