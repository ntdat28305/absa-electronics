import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, JSON, DateTime, Enum, ForeignKey, UniqueConstraint, Text
from database import Base

class CategoryEnum(str, enum.Enum):
    phone = "phone"
    laptop = "laptop"

class PlatformEnum(str, enum.Enum):
    shopee = "shopee"
    tiki = "tiki"
    both = "both"

class SourceEnum(str, enum.Enum):
    db_preset = "db_preset"
    user_search = "user_search"
    user_link = "user_link"

class QueryTypeEnum(str, enum.Enum):
    search = "search"
    link = "link"
    preset = "preset"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    display_name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class Device(Base):
    __tablename__ = "devices"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, index=True)
    category = Column(Enum(CategoryEnum), nullable=False)
    brand = Column(String, nullable=False, index=True)
    image_url = Column(String)
    platform = Column(Enum(PlatformEnum))
    product_url = Column(String)
    price = Column(String)
    overall_score = Column(Float, default=0.0)
    total_reviews_analyzed = Column(Integer, default=0)
    aspect_scores = Column(JSON, default=dict)
    crawled_at = Column(DateTime, default=datetime.utcnow)
    source = Column(Enum(SourceEnum), default=SourceEnum.db_preset)

class Review(Base):
    __tablename__ = "reviews"
    id = Column(Integer, primary_key=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    text = Column(Text, nullable=False)
    aspects = Column(JSON, default=list)
    platform = Column(String)
    crawled_at = Column(DateTime, default=datetime.utcnow)

class Favorite(Base):
    __tablename__ = "favorites"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    saved_at = Column(DateTime, default=datetime.utcnow)
    __table_args__ = (UniqueConstraint("user_id", "device_id"),)

class AnalysisHistory(Base):
    __tablename__ = "analysis_history"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="SET NULL"), nullable=True)
    query_type = Column(Enum(QueryTypeEnum), nullable=False)
    input_query = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
