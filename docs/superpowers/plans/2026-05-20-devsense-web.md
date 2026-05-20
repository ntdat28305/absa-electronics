# DevSense Web — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack web app for ABSA-based electronics review analysis with pre-crawled device DB, search-crawl, link analysis, auth, favorites, and history.

**Architecture:** 3-tier: React frontend (Railway) → FastAPI Main API (Railway + PostgreSQL) → Colab Worker (ngrok). Main API proxies crawl requests to Colab Worker via stored ngrok URL. Models stored on HuggingFace Space, called by Worker.

**Tech Stack:** React 18 + Vite + Tailwind CSS + Recharts | FastAPI + SQLAlchemy + PostgreSQL + python-jose + bcrypt + alembic | Selenium + requests + pyngrok | HuggingFace Space API

---

## File Map

```
backend/
  main.py                  FastAPI app, CORS, router registration
  config.py                env vars (DATABASE_URL, SECRET_KEY, WORKER_API_KEY)
  database.py              SQLAlchemy engine + get_db dependency
  models.py                all ORM models
  schemas.py               all Pydantic schemas
  scoring.py               overall_score formula
  auth/
    router.py              POST /auth/register, /auth/login, GET /auth/me
    service.py             register/login logic
    utils.py               JWT encode/decode, bcrypt hash/verify
  devices/
    router.py              GET /devices, GET /devices/{id}, GET /devices/search, POST /devices/batch
    service.py             device CRUD + score calculation
  crawl/
    router.py              POST /crawl/search, POST /crawl/link
    service.py             proxy requests to Colab Worker
  favorites/
    router.py              GET/POST/DELETE /favorites/{device_id}
  history/
    router.py              GET /history
  worker/
    router.py              POST /worker/register, GET /worker/health
    state.py               in-memory worker URL store
  alembic/                 DB migrations
  requirements.txt
  Dockerfile
  tests/
    conftest.py
    test_auth.py
    test_devices.py
    test_favorites.py
    test_history.py

frontend/
  src/
    main.jsx
    App.jsx
    api/
      client.js            axios instance with JWT interceptor
      auth.js
      devices.js
      crawl.js
      favorites.js
      history.js
    context/
      AuthContext.jsx
    components/
      Navbar.jsx
      DeviceCard.jsx
      AspectBadges.jsx
      RadarChart.jsx
      AspectProgressBars.jsx
      ReviewList.jsx
      WorkerStatus.jsx
    pages/
      Home.jsx             Kho DB
      DeviceDetail.jsx
      Search.jsx
      Analyze.jsx
      History.jsx
      Favorites.jsx
      Login.jsx
      Register.jsx
  package.json
  vite.config.js
  tailwind.config.js

worker/
  app.py                   FastAPI Worker endpoints
  crawler.py               Shopee + Tiki scrapers
  inferencer.py            HuggingFace Space API calls
  scoring.py               same formula as backend
  worker_notebook.ipynb    Colab notebook (install + run + ngrok + register)
  requirements.txt
```

---

## Phase 1 — Backend Foundation

### Task 1: Backend project setup

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/config.py`
- Create: `backend/database.py`
- Create: `backend/main.py`

- [ ] **Step 1: Create backend/requirements.txt**

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
sqlalchemy==2.0.30
alembic==1.13.1
psycopg2-binary==2.9.9
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.9
httpx==0.27.0
pytest==8.2.0
pytest-asyncio==0.23.6
```

- [ ] **Step 2: Create backend/config.py**

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = "sqlite:///./devsense.db"
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_days: int = 7
    worker_api_key: str = "worker-secret"

    class Config:
        env_file = ".env"

settings = Settings()
```

- [ ] **Step 3: Create backend/database.py**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

engine = create_engine(
    __import__("config").settings.database_url,
    connect_args={"check_same_thread": False} if "sqlite" in __import__("config").settings.database_url else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 4: Create backend/main.py**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import Base, engine

Base.metadata.create_all(bind=engine)

app = FastAPI(title="DevSense API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

- [ ] **Step 5: Install deps and verify server starts**

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```
Expected: `Application startup complete.` at http://127.0.0.1:8000/docs

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat: backend project scaffold"
```

---

### Task 2: Database models

**Files:**
- Create: `backend/models.py`
- Create: `backend/scoring.py`
- Create: `backend/tests/conftest.py`

- [ ] **Step 1: Create backend/models.py**

```python
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
```

- [ ] **Step 2: Create backend/scoring.py**

```python
import math

ASPECTS = ["Battery", "Camera", "Customer_Service", "Design", "Feature", "General", "Performance", "Price", "Screen"]

def compute_overall_score(aspect_scores: dict, total_reviews: int) -> float:
    """
    confidence = min(1.0, log(n+1) / log(31))
    score = (mean_positive * confidence + 50 * (1 - confidence)) / 10
    """
    values = [v for k, v in aspect_scores.items() if k in ASPECTS and v is not None]
    if not values:
        return 0.0
    mean_positive = sum(values) / len(values)
    confidence = min(1.0, math.log(total_reviews + 1) / math.log(31))
    return round((mean_positive * confidence + 50 * (1 - confidence)) / 10, 2)

def compute_aspect_scores(reviews_aspects: list[list[dict]]) -> dict:
    """
    reviews_aspects: list of per-review aspect lists
    Returns {aspect: positive_pct} for aspects with >= 1 mention
    """
    counts = {a: {"pos": 0, "total": 0} for a in ASPECTS}
    for aspects in reviews_aspects:
        for item in aspects:
            aspect = item.get("aspect", "")
            if aspect in counts:
                counts[aspect]["total"] += 1
                if item.get("sentiment", "").lower() == "positive":
                    counts[aspect]["pos"] += 1
    return {
        a: round(counts[a]["pos"] / counts[a]["total"] * 100, 1)
        for a in ASPECTS if counts[a]["total"] > 0
    }
```

- [ ] **Step 3: Write tests for scoring**

Create `backend/tests/test_scoring.py`:
```python
from scoring import compute_overall_score, compute_aspect_scores

def test_score_low_confidence():
    # 1 review, 100% positive → should NOT give 10
    score = compute_overall_score({"Battery": 100.0}, total_reviews=1)
    assert score < 8.0

def test_score_full_confidence():
    # 30 reviews, 85% → 8.5
    score = compute_overall_score({"Battery": 85.0}, total_reviews=30)
    assert abs(score - 8.5) < 0.01

def test_score_empty():
    assert compute_overall_score({}, total_reviews=0) == 0.0

def test_aspect_scores():
    reviews = [
        [{"aspect": "Battery", "sentiment": "Positive"}],
        [{"aspect": "Battery", "sentiment": "Negative"}],
        [{"aspect": "Camera", "sentiment": "Positive"}],
    ]
    result = compute_aspect_scores(reviews)
    assert result["Battery"] == 50.0
    assert result["Camera"] == 100.0
    assert "Screen" not in result
```

- [ ] **Step 4: Create backend/tests/conftest.py**

```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base, get_db
from main import app

TEST_DB = "sqlite:///./test_devsense.db"
engine = create_engine(TEST_DB, connect_args={"check_same_thread": False})
TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def db(setup_db):
    session = TestSession()
    try:
        yield session
    finally:
        session.close()

@pytest.fixture
def client(db):
    app.dependency_overrides[get_db] = lambda: db
    yield TestClient(app)
    app.dependency_overrides.clear()
```

- [ ] **Step 5: Run scoring tests**

```bash
cd backend
pytest tests/test_scoring.py -v
```
Expected: 4 passed

- [ ] **Step 6: Update main.py to import models**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import Base, engine
import models  # noqa: registers all models

Base.metadata.create_all(bind=engine)

app = FastAPI(title="DevSense API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

- [ ] **Step 7: Commit**

```bash
git add backend/
git commit -m "feat: db models and scoring formula"
```

---

### Task 3: Auth

**Files:**
- Create: `backend/auth/utils.py`
- Create: `backend/auth/service.py`
- Create: `backend/auth/router.py`
- Create: `backend/schemas.py`
- Create: `backend/tests/test_auth.py`

- [ ] **Step 1: Create backend/schemas.py**

```python
from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional

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
```

- [ ] **Step 2: Create backend/auth/utils.py**

```python
from datetime import datetime, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext
from config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_token(user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(days=settings.access_token_expire_days)
    return jwt.encode({"sub": str(user_id), "exp": expire}, settings.secret_key, algorithm=settings.algorithm)

def decode_token(token: str) -> int:
    payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    return int(payload["sub"])
```

- [ ] **Step 3: Create backend/auth/service.py**

```python
from sqlalchemy.orm import Session
from fastapi import HTTPException, status, Depends
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

def login(data: UserLogin, db: Session) -> tuple[str, User]:
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
```

- [ ] **Step 4: Create backend/auth/router.py**

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from auth.service import register, login, get_current_user
from schemas import UserRegister, UserLogin, Token, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=Token)
def register_route(data: UserRegister, db: Session = Depends(get_db)):
    user = register(data, db)
    from auth.utils import create_token
    return Token(access_token=create_token(user.id), user=UserOut.model_validate(user))

@router.post("/login", response_model=Token)
def login_route(data: UserLogin, db: Session = Depends(get_db)):
    token, user = login(data, db)
    return Token(access_token=token, user=UserOut.model_validate(user))

@router.get("/me", response_model=UserOut)
def me_route(user=Depends(get_current_user)):
    return user
```

- [ ] **Step 5: Register auth router in main.py**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import Base, engine
import models
from auth.router import router as auth_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="DevSense API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(auth_router)
```

- [ ] **Step 6: Write auth tests**

Create `backend/tests/test_auth.py`:
```python
def test_register(client):
    r = client.post("/auth/register", json={"email": "a@b.com", "password": "pass123", "display_name": "Alice"})
    assert r.status_code == 200
    assert "access_token" in r.json()

def test_register_duplicate(client):
    data = {"email": "a@b.com", "password": "pass123", "display_name": "Alice"}
    client.post("/auth/register", json=data)
    r = client.post("/auth/register", json=data)
    assert r.status_code == 400

def test_login(client):
    client.post("/auth/register", json={"email": "a@b.com", "password": "pass123", "display_name": "Alice"})
    r = client.post("/auth/login", json={"email": "a@b.com", "password": "pass123"})
    assert r.status_code == 200
    assert "access_token" in r.json()

def test_login_wrong_password(client):
    client.post("/auth/register", json={"email": "a@b.com", "password": "pass123", "display_name": "Alice"})
    r = client.post("/auth/login", json={"email": "a@b.com", "password": "wrong"})
    assert r.status_code == 401

def test_me(client):
    r = client.post("/auth/register", json={"email": "a@b.com", "password": "pass123", "display_name": "Alice"})
    token = r.json()["access_token"]
    r2 = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r2.status_code == 200
    assert r2.json()["email"] == "a@b.com"
```

- [ ] **Step 7: Run auth tests**

```bash
cd backend
pytest tests/test_auth.py -v
```
Expected: 5 passed

- [ ] **Step 8: Commit**

```bash
git add backend/
git commit -m "feat: auth register/login/JWT"
```

---

### Task 4: Device endpoints

**Files:**
- Create: `backend/devices/service.py`
- Create: `backend/devices/router.py`
- Create: `backend/tests/test_devices.py`

- [ ] **Step 1: Add device schemas to backend/schemas.py**

Append to existing `schemas.py`:
```python
from typing import Any
from models import CategoryEnum, PlatformEnum, SourceEnum

class DeviceOut(BaseModel):
    id: int
    name: str
    category: CategoryEnum
    brand: str
    image_url: Optional[str]
    platform: Optional[PlatformEnum]
    product_url: Optional[str]
    price: Optional[str]
    overall_score: float
    total_reviews_analyzed: int
    aspect_scores: Any
    source: SourceEnum
    model_config = {"from_attributes": True}

class ReviewOut(BaseModel):
    id: int
    text: str
    aspects: Any
    platform: Optional[str]
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
    reviews: list[dict]

class DeviceBatchRequest(BaseModel):
    devices: list[DeviceBatchItem]
    source: SourceEnum = SourceEnum.user_search
```

- [ ] **Step 2: Create backend/devices/service.py**

```python
from sqlalchemy.orm import Session
from models import Device, Review, SourceEnum
from scoring import compute_aspect_scores, compute_overall_score
from schemas import DeviceBatchItem

def list_devices(db: Session, category=None, brand=None, sort="score", page=1, limit=20):
    q = db.query(Device)
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
            db.add(Review(device_id=device.id, text=r["text"], aspects=r.get("aspects", []), platform=d.platform))
        saved.append(device)
    db.commit()
    return saved
```

- [ ] **Step 3: Create backend/devices/router.py**

```python
from fastapi import APIRouter, Depends, Query, Header, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from config import settings
from devices.service import list_devices, get_device, search_devices, save_batch
from schemas import DeviceOut, DeviceDetail, DeviceBatchRequest, ReviewOut
from typing import Optional

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
```

- [ ] **Step 4: Register devices router in main.py**

```python
from auth.router import router as auth_router
from devices.router import router as devices_router

app.include_router(auth_router)
app.include_router(devices_router)
```

- [ ] **Step 5: Write device tests**

Create `backend/tests/test_devices.py`:
```python
from models import Device, CategoryEnum, PlatformEnum, SourceEnum

def _seed_device(db):
    d = Device(name="iPhone 15", category=CategoryEnum.phone, brand="Apple",
               overall_score=8.4, total_reviews_analyzed=50,
               aspect_scores={"Battery": 80.0}, platform=PlatformEnum.shopee,
               source=SourceEnum.db_preset)
    db.add(d)
    db.commit()
    db.refresh(d)
    return d

def test_list_devices(client, db):
    _seed_device(db)
    r = client.get("/devices")
    assert r.status_code == 200
    assert r.json()["total"] == 1

def test_search_found(client, db):
    _seed_device(db)
    r = client.get("/devices/search?q=iphone")
    assert r.status_code == 200
    assert len(r.json()) == 1

def test_search_not_found(client, db):
    _seed_device(db)
    r = client.get("/devices/search?q=samsung")
    assert r.status_code == 200
    assert len(r.json()) == 0

def test_get_device(client, db):
    d = _seed_device(db)
    r = client.get(f"/devices/{d.id}")
    assert r.status_code == 200
    assert r.json()["name"] == "iPhone 15"

def test_batch_save(client):
    from config import settings
    payload = {
        "devices": [{
            "name": "Galaxy S24", "category": "phone", "brand": "Samsung",
            "platform": "shopee", "product_url": "https://shopee.vn/test",
            "reviews": [{"text": "Pin tốt", "aspects": [{"aspect": "Battery", "sentiment": "Positive", "confidence": 0.9}]}]
        }],
        "source": "user_search"
    }
    r = client.post("/devices/batch", json=payload, headers={"x-worker-key": settings.worker_api_key})
    assert r.status_code == 200
    assert r.json()[0]["name"] == "Galaxy S24"
```

- [ ] **Step 6: Run device tests**

```bash
pytest tests/test_devices.py -v
```
Expected: 5 passed

- [ ] **Step 7: Commit**

```bash
git add backend/
git commit -m "feat: device CRUD + batch save endpoint"
```

---

### Task 5: Worker state + crawl proxy

**Files:**
- Create: `backend/worker/state.py`
- Create: `backend/worker/router.py`
- Create: `backend/crawl/service.py`
- Create: `backend/crawl/router.py`

- [ ] **Step 1: Create backend/worker/state.py**

```python
_worker_url: str | None = None

def set_worker_url(url: str):
    global _worker_url
    _worker_url = url.rstrip("/")

def get_worker_url() -> str | None:
    return _worker_url
```

- [ ] **Step 2: Create backend/worker/router.py**

```python
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from worker.state import set_worker_url, get_worker_url
from config import settings
import httpx

router = APIRouter(prefix="/worker", tags=["worker"])

class RegisterRequest(BaseModel):
    url: str

@router.post("/register")
def register_worker(data: RegisterRequest, x_worker_key: str = Header(...)):
    if x_worker_key != settings.worker_api_key:
        raise HTTPException(status_code=403, detail="Invalid worker key")
    set_worker_url(data.url)
    return {"status": "registered", "url": data.url}

@router.get("/health")
def worker_health():
    url = get_worker_url()
    if not url:
        return {"online": False, "reason": "Worker chưa đăng ký URL"}
    try:
        r = httpx.get(f"{url}/health", timeout=5)
        return {"online": r.status_code == 200, "url": url}
    except Exception:
        return {"online": False, "url": url}
```

- [ ] **Step 3: Create backend/crawl/service.py**

```python
import httpx
from fastapi import HTTPException
from worker.state import get_worker_url
from config import settings

def proxy_to_worker(endpoint: str, payload: dict) -> dict:
    url = get_worker_url()
    if not url:
        raise HTTPException(status_code=503, detail="Worker đang offline. Vui lòng khởi động Colab.")
    try:
        r = httpx.post(f"{url}{endpoint}", json=payload,
                       headers={"x-worker-key": settings.worker_api_key}, timeout=300)
        r.raise_for_status()
        return r.json()
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Worker timeout. Thử lại với số reviews ít hơn.")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Worker error: {e.response.text}")
```

- [ ] **Step 4: Create backend/crawl/router.py**

```python
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from crawl.service import proxy_to_worker
from devices.service import save_batch, search_devices
from auth.service import get_current_user
from history.service import save_history
from schemas import DeviceBatchRequest, SourceEnum
import models

router = APIRouter(prefix="/crawl", tags=["crawl"])

class SearchRequest(BaseModel):
    query: str
    num_links: int = 3
    reviews_per_link: int = 50
    platform: str = "shopee"

class LinkRequest(BaseModel):
    url: str
    count: int = 50

@router.post("/search")
def crawl_search(data: SearchRequest, db: Session = Depends(get_db),
                 user: Optional[models.User] = Depends(get_current_user.__wrapped__ if hasattr(get_current_user, '__wrapped__') else lambda: None)):
    # Check DB first
    existing = search_devices(db, data.query)
    if existing:
        return {"source": "db", "devices": [d.id for d in existing]}
    # Crawl via worker
    result = proxy_to_worker("/crawl/search", data.model_dump())
    batch = DeviceBatchRequest(**result, source=SourceEnum.user_search)
    saved = save_batch(db, batch.devices, batch.source)
    if user:
        for d in saved:
            save_history(db, user.id, d.id, "search", data.query)
    return {"source": "crawled", "devices": [d.id for d in saved]}

@router.post("/link")
def crawl_link(data: LinkRequest, db: Session = Depends(get_db),
               user: Optional[models.User] = Depends(get_current_user.__wrapped__ if hasattr(get_current_user, '__wrapped__') else lambda: None)):
    result = proxy_to_worker("/crawl/link", data.model_dump())
    batch = DeviceBatchRequest(**result, source=SourceEnum.user_link)
    saved = save_batch(db, batch.devices, batch.source)
    if user:
        for d in saved:
            save_history(db, user.id, d.id, "link", data.url)
    return {"source": "crawled", "devices": [d.id for d in saved]}
```

- [ ] **Step 5: Commit (before history service exists — will fix in Task 6)**

```bash
git add backend/worker/ backend/crawl/
git commit -m "feat: worker state + crawl proxy endpoints"
```

---

### Task 6: Favorites + History

**Files:**
- Create: `backend/favorites/router.py`
- Create: `backend/history/service.py`
- Create: `backend/history/router.py`
- Create: `backend/tests/test_favorites.py`
- Create: `backend/tests/test_history.py`

- [ ] **Step 1: Create backend/history/service.py**

```python
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
```

- [ ] **Step 2: Create backend/history/router.py**

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from auth.service import get_current_user
from history.service import get_history
from schemas import UserOut
from pydantic import BaseModel
from typing import Any, Optional
from datetime import datetime

router = APIRouter(prefix="/history", tags=["history"])

class HistoryOut(BaseModel):
    id: int
    device_id: Optional[int]
    query_type: str
    input_query: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}

@router.get("")
def get_user_history(page: int = 1, db: Session = Depends(get_db), user=Depends(get_current_user)):
    items, total = get_history(db, user.id, page)
    return {"total": total, "page": page, "items": [HistoryOut.model_validate(h) for h in items]}
```

- [ ] **Step 3: Create backend/favorites/router.py**

```python
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
```

- [ ] **Step 4: Register all routers in main.py**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import Base, engine
import models
from auth.router import router as auth_router
from devices.router import router as devices_router
from worker.router import router as worker_router
from crawl.router import router as crawl_router
from favorites.router import router as favorites_router
from history.router import router as history_router

Base.metadata.create_all(bind=engine)
app = FastAPI(title="DevSense API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

for r in [auth_router, devices_router, worker_router, crawl_router, favorites_router, history_router]:
    app.include_router(r)
```

- [ ] **Step 5: Write favorites + history tests**

Create `backend/tests/test_favorites.py`:
```python
from models import Device, CategoryEnum, SourceEnum

def _register_and_login(client):
    client.post("/auth/register", json={"email": "a@b.com", "password": "pass", "display_name": "A"})
    r = client.post("/auth/login", json={"email": "a@b.com", "password": "pass"})
    return r.json()["access_token"]

def _seed_device(db):
    d = Device(name="iPhone 15", category=CategoryEnum.phone, brand="Apple",
               overall_score=8.0, total_reviews_analyzed=30, source=SourceEnum.db_preset)
    db.add(d)
    db.commit()
    db.refresh(d)
    return d

def test_add_and_get_favorite(client, db):
    token = _register_and_login(client)
    d = _seed_device(db)
    headers = {"Authorization": f"Bearer {token}"}
    r = client.post(f"/favorites/{d.id}", headers=headers)
    assert r.json()["status"] == "saved"
    r2 = client.get("/favorites", headers=headers)
    assert len(r2.json()) == 1

def test_remove_favorite(client, db):
    token = _register_and_login(client)
    d = _seed_device(db)
    headers = {"Authorization": f"Bearer {token}"}
    client.post(f"/favorites/{d.id}", headers=headers)
    r = client.delete(f"/favorites/{d.id}", headers=headers)
    assert r.json()["status"] == "removed"
    r2 = client.get("/favorites", headers=headers)
    assert len(r2.json()) == 0
```

- [ ] **Step 6: Run all tests**

```bash
cd backend
pytest tests/ -v
```
Expected: all tests passed

- [ ] **Step 7: Commit**

```bash
git add backend/
git commit -m "feat: favorites and history endpoints, all routers registered"
```

---

## Phase 2 — Frontend

### Task 7: Frontend project setup

**Files:**
- Create: `frontend/` (Vite scaffold)
- Create: `frontend/src/api/client.js`
- Create: `frontend/src/context/AuthContext.jsx`
- Create: `frontend/src/App.jsx`

- [ ] **Step 1: Scaffold Vite + React project**

```bash
cd ..
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install axios react-router-dom recharts
```

- [ ] **Step 2: Configure tailwind.config.js**

```js
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: { extend: {} },
  plugins: [],
}
```

- [ ] **Step 3: Replace src/index.css with Tailwind directives**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 4: Create frontend/src/api/client.js**

```js
import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const client = axios.create({ baseURL: BASE_URL });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default client;
```

- [ ] **Step 5: Create frontend/src/api/auth.js**

```js
import client from "./client";
export const register = (data) => client.post("/auth/register", data);
export const login = (data) => client.post("/auth/login", data);
export const getMe = () => client.get("/auth/me");
```

- [ ] **Step 6: Create frontend/src/api/devices.js**

```js
import client from "./client";
export const listDevices = (params) => client.get("/devices", { params });
export const getDevice = (id) => client.get(`/devices/${id}`);
export const searchDevices = (q) => client.get("/devices/search", { params: { q } });
```

- [ ] **Step 7: Create frontend/src/api/crawl.js**

```js
import client from "./client";
export const crawlSearch = (data) => client.post("/crawl/search", data);
export const crawlLink = (data) => client.post("/crawl/link", data);
```

- [ ] **Step 8: Create frontend/src/api/favorites.js**

```js
import client from "./client";
export const getFavorites = () => client.get("/favorites");
export const addFavorite = (id) => client.post(`/favorites/${id}`);
export const removeFavorite = (id) => client.delete(`/favorites/${id}`);
```

- [ ] **Step 9: Create frontend/src/api/history.js**

```js
import client from "./client";
export const getHistory = (page = 1) => client.get("/history", { params: { page } });
```

- [ ] **Step 10: Create frontend/src/context/AuthContext.jsx**

```jsx
import { createContext, useContext, useState, useEffect } from "react";
import { getMe } from "../api/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      getMe().then(r => setUser(r.data)).catch(() => localStorage.removeItem("token")).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const loginUser = (token, userData) => {
    localStorage.setItem("token", token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, loginUser, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
```

- [ ] **Step 11: Create frontend/src/App.jsx**

```jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import DeviceDetail from "./pages/DeviceDetail";
import Search from "./pages/Search";
import Analyze from "./pages/Analyze";
import History from "./pages/History";
import Favorites from "./pages/Favorites";
import Login from "./pages/Login";
import Register from "./pages/Register";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-950 text-gray-100">
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/devices/:id" element={<DeviceDetail />} />
            <Route path="/search" element={<Search />} />
            <Route path="/analyze" element={<Analyze />} />
            <Route path="/history" element={<History />} />
            <Route path="/favorites" element={<Favorites />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

- [ ] **Step 12: Create frontend/.env.example**

```
VITE_API_URL=http://127.0.0.1:8000
```

- [ ] **Step 13: Run dev server and verify routing works**

```bash
cd frontend
cp .env.example .env
npm run dev
```
Expected: app loads at http://localhost:5173, no console errors

- [ ] **Step 14: Commit**

```bash
git add frontend/
git commit -m "feat: frontend scaffold + routing + auth context + api layer"
```

---

### Task 8: Shared components

**Files:**
- Create: `frontend/src/components/Navbar.jsx`
- Create: `frontend/src/components/DeviceCard.jsx`
- Create: `frontend/src/components/AspectBadges.jsx`
- Create: `frontend/src/components/AspectProgressBars.jsx`
- Create: `frontend/src/components/WorkerStatus.jsx`

- [ ] **Step 1: Create frontend/src/components/Navbar.jsx**

```jsx
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center gap-6">
      <Link to="/" className="font-bold text-orange-500 text-lg">⚡ DevSense</Link>
      <div className="flex gap-4 flex-1">
        <Link to="/" className="text-sm text-gray-400 hover:text-white">🗄 Kho DB</Link>
        <Link to="/search" className="text-sm text-gray-400 hover:text-white">🔍 Tìm kiếm</Link>
        <Link to="/analyze" className="text-sm text-gray-400 hover:text-white">🔗 Phân tích link</Link>
        {user && <Link to="/history" className="text-sm text-gray-400 hover:text-white">🕐 Lịch sử</Link>}
        {user && <Link to="/favorites" className="text-sm text-gray-400 hover:text-white">♡ Ưu thích</Link>}
      </div>
      {user ? (
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-300">{user.display_name}</span>
          <button onClick={() => { logout(); navigate("/"); }} className="text-sm text-gray-500 hover:text-red-400">Đăng xuất</button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Link to="/login" className="text-sm text-gray-400 hover:text-white">Đăng nhập</Link>
          <Link to="/register" className="text-sm bg-orange-500 text-white px-3 py-1 rounded hover:bg-orange-600">Đăng ký</Link>
        </div>
      )}
    </nav>
  );
}
```

- [ ] **Step 2: Create frontend/src/components/AspectBadges.jsx**

```jsx
const COLORS = {
  positive: "bg-green-900/40 text-green-400 border border-green-800",
  negative: "bg-red-900/40 text-red-400 border border-red-800",
};
const ASPECT_ICONS = {
  Battery: "🔋", Camera: "📸", Customer_Service: "🤝", Design: "✨",
  Feature: "⚙️", General: "📋", Performance: "⚡", Price: "💰", Screen: "📱",
};

export default function AspectBadges({ aspectScores = {} }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Object.entries(aspectScores).map(([aspect, pct]) => (
        <span key={aspect} className={`text-xs px-2 py-0.5 rounded font-mono ${pct >= 50 ? COLORS.positive : COLORS.negative}`}>
          {ASPECT_ICONS[aspect] || "•"} {aspect} {pct}%{pct >= 50 ? "↑" : "↓"}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create frontend/src/components/AspectProgressBars.jsx**

```jsx
const ASPECT_ICONS = {
  Battery: "🔋", Camera: "📸", Customer_Service: "🤝", Design: "✨",
  Feature: "⚙️", General: "📋", Performance: "⚡", Price: "💰", Screen: "📱",
};

export default function AspectProgressBars({ aspectScores = {} }) {
  return (
    <div className="flex flex-col gap-2">
      {Object.entries(aspectScores).map(([aspect, pct]) => (
        <div key={aspect} className="flex items-center gap-3">
          <span className="w-32 text-xs text-gray-400 font-mono shrink-0">
            {ASPECT_ICONS[aspect]} {aspect}
          </span>
          <div className="flex-1 h-2 bg-gray-800 rounded overflow-hidden">
            <div
              className={`h-full rounded transition-all ${pct >= 50 ? "bg-green-500" : "bg-red-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className={`text-xs font-mono w-10 text-right ${pct >= 50 ? "text-green-400" : "text-red-400"}`}>
            {pct}%
          </span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create frontend/src/components/DeviceCard.jsx**

```jsx
import { Link } from "react-router-dom";
import { addFavorite, removeFavorite } from "../api/favorites";
import { useAuth } from "../context/AuthContext";
import { useState } from "react";
import AspectBadges from "./AspectBadges";

export default function DeviceCard({ device, isFavorited = false, onFavoriteChange }) {
  const { user } = useAuth();
  const [fav, setFav] = useState(isFavorited);
  const [loading, setLoading] = useState(false);

  const topAspects = Object.fromEntries(
    Object.entries(device.aspect_scores || {}).sort((a, b) => b[1] - a[1]).slice(0, 3)
  );

  const toggleFav = async (e) => {
    e.preventDefault();
    if (!user) return alert("Vui lòng đăng nhập để lưu ưu thích");
    setLoading(true);
    try {
      if (fav) {
        await removeFavorite(device.id);
        setFav(false);
      } else {
        await addFavorite(device.id);
        setFav(true);
      }
      onFavoriteChange?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Link to={`/devices/${device.id}`} className="block bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-orange-500/50 transition-colors">
      <div className="relative">
        {device.image_url ? (
          <img src={device.image_url} alt={device.name} className="w-full h-40 object-contain bg-gray-800 p-2" />
        ) : (
          <div className="w-full h-40 bg-gray-800 flex items-center justify-center text-4xl">📱</div>
        )}
        <button onClick={toggleFav} disabled={loading}
          className={`absolute top-2 right-2 text-lg ${fav ? "text-red-500" : "text-gray-500 hover:text-red-400"}`}>
          {fav ? "♥" : "♡"}
        </button>
      </div>
      <div className="p-3">
        <div className="font-semibold text-sm text-white truncate">{device.name}</div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-2xl font-bold text-blue-400">{device.overall_score.toFixed(1)}</span>
          <span className="text-xs text-gray-500">{device.total_reviews_analyzed} reviews</span>
        </div>
        {device.price && <div className="text-xs text-orange-400 mt-1">{device.price}</div>}
        <div className="mt-2">
          <AspectBadges aspectScores={topAspects} />
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 5: Create frontend/src/components/WorkerStatus.jsx**

```jsx
import { useEffect, useState } from "react";
import client from "../api/client";

export default function WorkerStatus() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    client.get("/worker/health").then(r => setStatus(r.data)).catch(() => setStatus({ online: false }));
  }, []);

  if (!status) return null;
  return (
    <div className={`flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded ${status.online ? "text-green-400" : "text-red-400"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status.online ? "bg-green-400" : "bg-red-400"}`} />
      Worker {status.online ? "online" : "offline"}
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/
git commit -m "feat: shared components (Navbar, DeviceCard, AspectBadges, WorkerStatus)"
```

---

### Task 9: Home page (Kho DB)

**Files:**
- Create: `frontend/src/pages/Home.jsx`

- [ ] **Step 1: Create frontend/src/pages/Home.jsx**

```jsx
import { useEffect, useState } from "react";
import { listDevices } from "../api/devices";
import { getFavorites } from "../api/favorites";
import DeviceCard from "../components/DeviceCard";
import { useAuth } from "../context/AuthContext";

const BRANDS = ["Apple", "Samsung", "ASUS", "Dell", "Xiaomi", "Oppo", "Vivo"];

export default function Home() {
  const { user } = useAuth();
  const [devices, setDevices] = useState([]);
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [sort, setSort] = useState("score");
  const [page, setPage] = useState(1);
  const [favorites, setFavorites] = useState(new Set());
  const [loading, setLoading] = useState(true);

  const fetchFavs = async () => {
    if (!user) return;
    try {
      const r = await getFavorites();
      setFavorites(new Set(r.data.map(d => d.id)));
    } catch {}
  };

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const r = await listDevices({ category: category || undefined, brand: brand || undefined, sort, page });
      setDevices(r.data.items);
      setTotal(r.data.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDevices(); }, [category, brand, sort, page]);
  useEffect(() => { fetchFavs(); }, [user]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex gap-6">
        {/* Sidebar */}
        <aside className="w-48 shrink-0">
          <h3 className="text-xs font-mono text-gray-500 uppercase mb-3">Danh mục</h3>
          {[["", "Tất cả"], ["phone", "📱 Điện thoại"], ["laptop", "💻 Laptop"]].map(([v, l]) => (
            <button key={v} onClick={() => { setCategory(v); setPage(1); }}
              className={`block w-full text-left text-sm px-3 py-1.5 rounded mb-1 ${category === v ? "bg-orange-500/20 text-orange-400" : "text-gray-400 hover:text-white"}`}>
              {l}
            </button>
          ))}
          <h3 className="text-xs font-mono text-gray-500 uppercase mt-4 mb-3">Hãng</h3>
          {["", ...BRANDS].map(b => (
            <button key={b} onClick={() => { setBrand(b); setPage(1); }}
              className={`block w-full text-left text-sm px-3 py-1.5 rounded mb-1 ${brand === b ? "bg-orange-500/20 text-orange-400" : "text-gray-400 hover:text-white"}`}>
              {b || "Tất cả"}
            </button>
          ))}
        </aside>

        {/* Main */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-bold">Kho thiết bị <span className="text-gray-500 text-sm font-normal">({total} thiết bị)</span></h1>
            <select value={sort} onChange={e => setSort(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-sm rounded px-2 py-1 text-gray-300">
              <option value="score">Điểm cao nhất</option>
              <option value="newest">Mới nhất</option>
            </select>
          </div>
          {loading ? (
            <div className="text-center py-20 text-gray-500">Đang tải...</div>
          ) : devices.length === 0 ? (
            <div className="text-center py-20 text-gray-500">Chưa có thiết bị nào trong kho</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {devices.map(d => (
                <DeviceCard key={d.id} device={d} isFavorited={favorites.has(d.id)} onFavoriteChange={fetchFavs} />
              ))}
            </div>
          )}
          {/* Pagination */}
          {total > 20 && (
            <div className="flex gap-2 justify-center mt-6">
              {page > 1 && <button onClick={() => setPage(p => p - 1)} className="px-3 py-1 bg-gray-800 rounded text-sm">← Trước</button>}
              <span className="px-3 py-1 text-sm text-gray-400">Trang {page}</span>
              {page * 20 < total && <button onClick={() => setPage(p => p + 1)} className="px-3 py-1 bg-gray-800 rounded text-sm">Tiếp →</button>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser** — start both backend and frontend, navigate to `/`, ensure device grid renders (empty state OK)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Home.jsx
git commit -m "feat: home page with device grid, filter, sort, pagination"
```

---

### Task 10: Device detail page

**Files:**
- Create: `frontend/src/pages/DeviceDetail.jsx`
- Create: `frontend/src/components/RadarChart.jsx`
- Create: `frontend/src/components/ReviewList.jsx`

- [ ] **Step 1: Create frontend/src/components/RadarChart.jsx**

```jsx
import { Radar, RadarChart as RC, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";

export default function RadarChart({ aspectScores = {} }) {
  const data = Object.entries(aspectScores).map(([aspect, value]) => ({ aspect, value }));
  if (data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <RC data={data}>
        <PolarGrid stroke="#374151" />
        <PolarAngleAxis dataKey="aspect" tick={{ fill: "#9CA3AF", fontSize: 11 }} />
        <Radar name="Score" dataKey="value" stroke="#f97316" fill="#f97316" fillOpacity={0.2} />
      </RC>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Create frontend/src/components/ReviewList.jsx**

```jsx
import { useState } from "react";

const ASPECTS = ["Battery","Camera","Customer_Service","Design","Feature","General","Performance","Price","Screen"];

export default function ReviewList({ reviews = [] }) {
  const [filterAspect, setFilterAspect] = useState("");
  const [filterSentiment, setFilterSentiment] = useState("");

  const filtered = reviews.filter(r => {
    const aspects = r.aspects || [];
    if (filterAspect && !aspects.find(a => a.aspect === filterAspect)) return false;
    if (filterSentiment && !aspects.find(a => a.sentiment?.toLowerCase() === filterSentiment)) return false;
    return true;
  });

  return (
    <div>
      <div className="flex gap-2 mb-3 flex-wrap">
        <select value={filterAspect} onChange={e => setFilterAspect(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-xs rounded px-2 py-1 text-gray-300">
          <option value="">Tất cả khía cạnh</option>
          {ASPECTS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filterSentiment} onChange={e => setFilterSentiment(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-xs rounded px-2 py-1 text-gray-300">
          <option value="">Tất cả cảm xúc</option>
          <option value="positive">Positive</option>
          <option value="negative">Negative</option>
        </select>
        <span className="text-xs text-gray-500 self-center">{filtered.length} reviews</span>
      </div>
      <div className="flex flex-col gap-3 max-h-96 overflow-y-auto">
        {filtered.map((r, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg p-3">
            <div className="flex flex-wrap gap-1 mb-2">
              {(r.aspects || []).map((a, j) => (
                <span key={j} className={`text-xs px-2 py-0.5 rounded font-mono ${
                  a.sentiment?.toLowerCase() === "positive"
                    ? "bg-green-900/40 text-green-400"
                    : "bg-red-900/40 text-red-400"
                }`}>
                  {a.aspect} {a.confidence ? `${Math.round(a.confidence * 100)}%` : ""}
                </span>
              ))}
            </div>
            <p className="text-sm text-gray-300">{r.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create frontend/src/pages/DeviceDetail.jsx**

```jsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getDevice } from "../api/devices";
import { addFavorite, removeFavorite, getFavorites } from "../api/favorites";
import { useAuth } from "../context/AuthContext";
import RadarChart from "../components/RadarChart";
import AspectProgressBars from "../components/AspectProgressBars";
import ReviewList from "../components/ReviewList";

export default function DeviceDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [device, setDevice] = useState(null);
  const [fav, setFav] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getDevice(id),
      user ? getFavorites() : Promise.resolve({ data: [] })
    ]).then(([dr, fr]) => {
      setDevice(dr.data);
      setFav(fr.data.some(d => d.id === parseInt(id)));
    }).finally(() => setLoading(false));
  }, [id, user]);

  const toggleFav = async () => {
    if (!user) return alert("Vui lòng đăng nhập");
    if (fav) { await removeFavorite(id); setFav(false); }
    else { await addFavorite(id); setFav(true); }
  };

  if (loading) return <div className="text-center py-20 text-gray-500">Đang tải...</div>;
  if (!device) return <div className="text-center py-20 text-red-400">Không tìm thấy thiết bị</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex gap-6 mb-8">
        {device.image_url ? (
          <img src={device.image_url} alt={device.name} className="w-40 h-40 object-contain bg-gray-800 rounded-xl p-2 shrink-0" />
        ) : (
          <div className="w-40 h-40 bg-gray-800 rounded-xl flex items-center justify-center text-5xl shrink-0">📱</div>
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{device.name}</h1>
          <div className="flex items-end gap-2 mt-1">
            <span className="text-4xl font-bold text-blue-400">{device.overall_score.toFixed(1)}</span>
            <span className="text-gray-500 mb-1">/ 10</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">{device.total_reviews_analyzed} reviews phân tích · {device.platform}</p>
          {device.price && <p className="text-orange-400 mt-1">{device.price}</p>}
          <div className="flex gap-3 mt-3">
            {device.product_url && (
              <a href={device.product_url} target="_blank" rel="noreferrer"
                className="text-sm bg-orange-500 text-white px-4 py-1.5 rounded hover:bg-orange-600">
                🛒 Mua ngay
              </a>
            )}
            <button onClick={toggleFav}
              className={`text-sm px-4 py-1.5 rounded border ${fav ? "border-red-500 text-red-400" : "border-gray-600 text-gray-400 hover:border-red-500"}`}>
              {fav ? "♥ Đã lưu" : "♡ Lưu"}
            </button>
          </div>
        </div>
      </div>

      {/* Analysis */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-mono text-gray-400 uppercase mb-3">Radar</h2>
          <RadarChart aspectScores={device.aspect_scores} />
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-mono text-gray-400 uppercase mb-3">Chi tiết khía cạnh</h2>
          <AspectProgressBars aspectScores={device.aspect_scores} />
        </div>
      </div>

      {/* Reviews */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-mono text-gray-400 uppercase mb-3">Bình luận ({device.reviews?.length || 0})</h2>
        <ReviewList reviews={device.reviews || []} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/
git commit -m "feat: device detail page with radar chart, progress bars, review list"
```

---

### Task 11: Search page

**Files:**
- Create: `frontend/src/pages/Search.jsx`

- [ ] **Step 1: Create frontend/src/pages/Search.jsx**

```jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { searchDevices } from "../api/devices";
import { crawlSearch } from "../api/crawl";
import DeviceCard from "../components/DeviceCard";
import WorkerStatus from "../components/WorkerStatus";

export default function Search() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [phase, setPhase] = useState("idle"); // idle | found | notfound | crawling | done | error
  const [crawlOpts, setCrawlOpts] = useState({ num_links: 3, reviews_per_link: 50, platform: "shopee" });
  const [error, setError] = useState("");

  const handleSearch = async () => {
    if (!query.trim()) return;
    setPhase("searching");
    setError("");
    try {
      const r = await searchDevices(query);
      if (r.data.length > 0) {
        setResults(r.data);
        setPhase("found");
      } else {
        setPhase("notfound");
      }
    } catch {
      setPhase("error");
      setError("Lỗi kết nối API");
    }
  };

  const handleCrawl = async () => {
    setPhase("crawling");
    setError("");
    try {
      const r = await crawlSearch({ query, ...crawlOpts });
      if (r.data.source === "crawled") {
        setPhase("done");
        // Fetch the newly saved devices
        const r2 = await searchDevices(query);
        setResults(r2.data);
      }
    } catch (e) {
      setPhase("error");
      setError(e.response?.data?.detail || "Worker offline hoặc lỗi crawl");
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Tìm kiếm thiết bị</h1>
        <WorkerStatus />
      </div>

      {/* Search bar */}
      <div className="flex gap-2 mb-6">
        <input value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSearch()}
          placeholder="Nhập tên thiết bị... (VD: iPhone 15, ASUS Zenbook)"
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-orange-500" />
        <button onClick={handleSearch} disabled={phase === "searching" || phase === "crawling"}
          className="bg-orange-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-orange-600 disabled:opacity-50">
          {phase === "searching" ? "Đang tìm..." : "Tìm"}
        </button>
      </div>

      {/* DB results */}
      {phase === "found" && (
        <div>
          <p className="text-sm text-green-400 mb-4">✓ Tìm thấy {results.length} thiết bị trong kho DB</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {results.map(d => <DeviceCard key={d.id} device={d} />)}
          </div>
        </div>
      )}

      {/* Not found — show crawl form */}
      {(phase === "notfound" || phase === "crawling" || phase === "done") && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-sm text-yellow-400 mb-4">⚠ Không tìm thấy "{query}" trong DB. Cào mới từ Shopee/Tiki:</p>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Số sản phẩm cần lấy</label>
              <input type="number" min={1} max={10} value={crawlOpts.num_links}
                onChange={e => setCrawlOpts(o => ({ ...o, num_links: parseInt(e.target.value) }))}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Reviews / sản phẩm</label>
              <input type="number" min={10} max={200} value={crawlOpts.reviews_per_link}
                onChange={e => setCrawlOpts(o => ({ ...o, reviews_per_link: parseInt(e.target.value) }))}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Nền tảng</label>
              <select value={crawlOpts.platform} onChange={e => setCrawlOpts(o => ({ ...o, platform: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm">
                <option value="shopee">Shopee</option>
                <option value="tiki">Tiki</option>
                <option value="both">Cả hai</option>
              </select>
            </div>
          </div>
          <button onClick={handleCrawl} disabled={phase === "crawling"}
            className="bg-orange-500 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600 disabled:opacity-50">
            {phase === "crawling" ? "⏳ Đang cào... (có thể mất vài phút)" : "▶ Bắt đầu cào"}
          </button>
        </div>
      )}

      {/* Crawl results */}
      {phase === "done" && results.length > 0 && (
        <div className="mt-6">
          <p className="text-sm text-green-400 mb-4">✓ Đã cào và phân tích xong {results.length} sản phẩm</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {results.map(d => <DeviceCard key={d.id} device={d} />)}
          </div>
        </div>
      )}

      {phase === "error" && <p className="text-red-400 text-sm mt-4">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Search.jsx
git commit -m "feat: search page with DB lookup and crawl fallback"
```

---

### Task 12: Analyze + History + Favorites + Auth pages

**Files:**
- Create: `frontend/src/pages/Analyze.jsx`
- Create: `frontend/src/pages/History.jsx`
- Create: `frontend/src/pages/Favorites.jsx`
- Create: `frontend/src/pages/Login.jsx`
- Create: `frontend/src/pages/Register.jsx`

- [ ] **Step 1: Create frontend/src/pages/Analyze.jsx**

```jsx
import { useState } from "react";
import { crawlLink } from "../api/crawl";
import { getDevice } from "../api/devices";
import DeviceCard from "../components/DeviceCard";
import WorkerStatus from "../components/WorkerStatus";

export default function Analyze() {
  const [url, setUrl] = useState("");
  const [count, setCount] = useState(50);
  const [phase, setPhase] = useState("idle");
  const [device, setDevice] = useState(null);
  const [error, setError] = useState("");

  const isValidUrl = (s) => s.includes("shopee.vn") || s.includes("tiki.vn");

  const handleAnalyze = async () => {
    if (!isValidUrl(url)) { setError("Chỉ hỗ trợ link Shopee hoặc Tiki"); return; }
    setPhase("crawling");
    setError("");
    try {
      const r = await crawlLink({ url, count });
      const deviceId = r.data.devices[0];
      const dr = await getDevice(deviceId);
      setDevice(dr.data);
      setPhase("done");
    } catch (e) {
      setPhase("error");
      setError(e.response?.data?.detail || "Worker offline hoặc lỗi crawl");
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Phân tích link sản phẩm</h1>
        <WorkerStatus />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <label className="text-xs text-gray-400 block mb-1">Link sản phẩm (Shopee hoặc Tiki)</label>
        <input value={url} onChange={e => setUrl(e.target.value)}
          placeholder="https://shopee.vn/..."
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm mb-3 outline-none focus:border-orange-500" />
        <div className="flex items-center gap-4 mb-4">
          <label className="text-xs text-gray-400">Số reviews cần cào:</label>
          <input type="number" min={10} max={200} value={count}
            onChange={e => setCount(parseInt(e.target.value))}
            className="w-24 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm" />
        </div>
        <button onClick={handleAnalyze} disabled={phase === "crawling"}
          className="bg-orange-500 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600 disabled:opacity-50">
          {phase === "crawling" ? "⏳ Đang phân tích..." : "▶ Phân tích"}
        </button>
        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      </div>

      {phase === "done" && device && (
        <div>
          <p className="text-sm text-green-400 mb-4">✓ Phân tích xong! Kết quả đã lưu vào lịch sử.</p>
          <DeviceCard device={device} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create frontend/src/pages/History.jsx**

```jsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getHistory } from "../api/history";
import { useAuth } from "../context/AuthContext";

const TYPE_ICON = { search: "🔍", link: "🔗", preset: "🗄" };

export default function History() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [user, loading]);

  useEffect(() => {
    if (user) getHistory(page).then(r => { setItems(r.data.items); setTotal(r.data.total); });
  }, [user, page]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold mb-6">Lịch sử phân tích ({total})</h1>
      {items.length === 0 ? (
        <p className="text-gray-500 text-center py-12">Chưa có lịch sử</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map(h => (
            <Link key={h.id} to={h.device_id ? `/devices/${h.device_id}` : "#"}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-4 hover:border-orange-500/50 transition-colors">
              <span className="text-2xl">{TYPE_ICON[h.query_type]}</span>
              <div className="flex-1">
                <p className="text-sm text-white">{h.input_query}</p>
                <p className="text-xs text-gray-500 mt-0.5">{new Date(h.created_at).toLocaleString("vi-VN")}</p>
              </div>
              <span className="text-xs text-gray-500 capitalize">{h.query_type}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create frontend/src/pages/Favorites.jsx**

```jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getFavorites } from "../api/favorites";
import DeviceCard from "../components/DeviceCard";
import { useAuth } from "../context/AuthContext";

export default function Favorites() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [devices, setDevices] = useState([]);

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [user, loading]);

  const fetchFavs = () => {
    if (user) getFavorites().then(r => setDevices(r.data));
  };

  useEffect(() => { fetchFavs(); }, [user]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold mb-6">Thiết bị yêu thích ({devices.length})</h1>
      {devices.length === 0 ? (
        <p className="text-gray-500 text-center py-12">Chưa có thiết bị nào</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {devices.map(d => <DeviceCard key={d.id} device={d} isFavorited onFavoriteChange={fetchFavs} />)}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create frontend/src/pages/Login.jsx**

```jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../api/auth";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { loginUser } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const r = await login(form);
      loginUser(r.data.access_token, r.data.user);
      navigate("/");
    } catch (e) {
      setError(e.response?.data?.detail || "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl p-8">
        <h1 className="text-xl font-bold text-center mb-6">Đăng nhập</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input type="email" placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2.5 text-sm outline-none focus:border-orange-500" required />
          <input type="password" placeholder="Mật khẩu" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2.5 text-sm outline-none focus:border-orange-500" required />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button type="submit" disabled={loading}
            className="bg-orange-500 text-white py-2.5 rounded text-sm font-semibold hover:bg-orange-600 disabled:opacity-50">
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">
          Chưa có tài khoản? <Link to="/register" className="text-orange-400 hover:underline">Đăng ký</Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create frontend/src/pages/Register.jsx**

```jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "../api/auth";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const navigate = useNavigate();
  const { loginUser } = useAuth();
  const [form, setForm] = useState({ email: "", password: "", display_name: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const r = await register(form);
      loginUser(r.data.access_token, r.data.user);
      navigate("/");
    } catch (e) {
      setError(e.response?.data?.detail || "Đăng ký thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl p-8">
        <h1 className="text-xl font-bold text-center mb-6">Đăng ký</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input placeholder="Tên hiển thị" value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2.5 text-sm outline-none focus:border-orange-500" required />
          <input type="email" placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2.5 text-sm outline-none focus:border-orange-500" required />
          <input type="password" placeholder="Mật khẩu" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2.5 text-sm outline-none focus:border-orange-500" required />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button type="submit" disabled={loading}
            className="bg-orange-500 text-white py-2.5 rounded text-sm font-semibold hover:bg-orange-600 disabled:opacity-50">
            {loading ? "Đang đăng ký..." : "Đăng ký"}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">
          Đã có tài khoản? <Link to="/login" className="text-orange-400 hover:underline">Đăng nhập</Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify all pages render without errors**

```bash
cd frontend && npm run dev
```
Navigate to: `/`, `/search`, `/analyze`, `/login`, `/register`
Expected: all pages render, no console errors

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/
git commit -m "feat: all frontend pages (analyze, history, favorites, auth)"
```

---

## Phase 3 — Colab Worker

### Task 13: Worker scrapers

**Files:**
- Create: `worker/crawler.py`

- [ ] **Step 1: Create worker/crawler.py**

```python
import requests
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options

def get_chrome_driver():
    opts = Options()
    opts.add_argument("--headless")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-blink-features=AutomationControlled")
    opts.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
    return webdriver.Chrome(options=opts)

# ─── Shopee Search API ─────────────────────────────────────────
def search_shopee(query: str, num_links: int) -> list[dict]:
    url = "https://shopee.vn/api/v4/search/search_items"
    params = {"by": "relevancy", "keyword": query, "limit": num_links, "order": "desc", "page_type": "search"}
    headers = {"User-Agent": "Mozilla/5.0", "Referer": "https://shopee.vn/"}
    r = requests.get(url, params=params, headers=headers, timeout=15)
    items = r.json().get("items", [])[:num_links]
    results = []
    for item in items:
        d = item.get("item_basic", {})
        results.append({
            "name": d.get("name", ""),
            "image_url": f"https://cf.shopee.vn/file/{d.get('image', '')}",
            "price": str(int(d.get("price", 0) / 100000) / 10) + "M đ",
            "product_url": f"https://shopee.vn/product/{d.get('shopid')}/{d.get('itemid')}",
            "platform": "shopee",
            "shop_id": d.get("shopid"),
            "item_id": d.get("itemid"),
        })
    return results

# ─── Tiki Search API ───────────────────────────────────────────
def search_tiki(query: str, num_links: int) -> list[dict]:
    url = "https://tiki.vn/api/v2/products"
    params = {"q": query, "limit": num_links, "sort": "top_seller"}
    headers = {"User-Agent": "Mozilla/5.0", "Referer": "https://tiki.vn/"}
    r = requests.get(url, params=params, headers=headers, timeout=15)
    items = r.json().get("data", [])[:num_links]
    results = []
    for item in items:
        results.append({
            "name": item.get("name", ""),
            "image_url": item.get("thumbnail_url", ""),
            "price": f"{item.get('price', 0):,}đ",
            "product_url": f"https://tiki.vn/{item.get('url_path', '')}",
            "platform": "tiki",
            "product_id": item.get("id"),
            "seller_id": item.get("seller_id"),
        })
    return results

# ─── Shopee Reviews (Selenium) ─────────────────────────────────
def scrape_shopee_reviews(shop_id: int, item_id: int, count: int) -> list[str]:
    reviews = []
    page = 0
    while len(reviews) < count:
        url = f"https://shopee.vn/api/v2/item/get_ratings?itemid={item_id}&shopid={shop_id}&limit=20&offset={page*20}&type=0"
        headers = {"User-Agent": "Mozilla/5.0", "Referer": f"https://shopee.vn/product/{shop_id}/{item_id}"}
        try:
            r = requests.get(url, headers=headers, timeout=10)
            ratings = r.json().get("data", {}).get("ratings", [])
            if not ratings:
                break
            for rating in ratings:
                comment = rating.get("comment", "").strip()
                if comment:
                    reviews.append(comment)
            page += 1
            time.sleep(0.5)
        except Exception:
            break
    return list(set(reviews))[:count]

# ─── Tiki Reviews (API) ────────────────────────────────────────
def scrape_tiki_reviews(product_id: int, seller_id: int, count: int) -> list[str]:
    reviews = []
    page = 1
    while len(reviews) < count:
        url = f"https://tiki.vn/api/v2/reviews?product_id={product_id}&seller_id={seller_id}&page={page}&limit=20"
        headers = {"User-Agent": "Mozilla/5.0", "Referer": "https://tiki.vn/"}
        try:
            r = requests.get(url, headers=headers, timeout=10)
            data = r.json().get("data", [])
            if not data:
                break
            for item in data:
                content = item.get("content", "").strip()
                if content:
                    reviews.append(content)
            page += 1
            time.sleep(0.5)
        except Exception:
            break
    return list(set(reviews))[:count]

def crawl_product(product_info: dict, count: int) -> list[str]:
    platform = product_info.get("platform")
    if platform == "shopee":
        return scrape_shopee_reviews(product_info["shop_id"], product_info["item_id"], count)
    elif platform == "tiki":
        return scrape_tiki_reviews(product_info["product_id"], product_info["seller_id"], count)
    return []
```

- [ ] **Step 2: Commit**

```bash
git add worker/crawler.py
git commit -m "feat: shopee and tiki scrapers (search + review crawl)"
```

---

### Task 14: Worker inference + FastAPI + Colab notebook

**Files:**
- Create: `worker/inferencer.py`
- Create: `worker/scoring.py`
- Create: `worker/app.py`
- Create: `worker/requirements.txt`
- Create: `worker/worker_notebook.ipynb`

- [ ] **Step 1: Create worker/scoring.py** (same formula as backend)

```python
import math

ASPECTS = ["Battery","Camera","Customer_Service","Design","Feature","General","Performance","Price","Screen"]

def compute_aspect_scores(reviews_aspects):
    counts = {a: {"pos": 0, "total": 0} for a in ASPECTS}
    for aspects in reviews_aspects:
        for item in aspects:
            aspect = item.get("aspect", "")
            if aspect in counts:
                counts[aspect]["total"] += 1
                if item.get("sentiment", "").lower() == "positive":
                    counts[aspect]["pos"] += 1
    return {
        a: round(counts[a]["pos"] / counts[a]["total"] * 100, 1)
        for a in ASPECTS if counts[a]["total"] > 0
    }

def compute_overall_score(aspect_scores, total_reviews):
    values = [v for k, v in aspect_scores.items() if k in ASPECTS]
    if not values:
        return 0.0
    mean_positive = sum(values) / len(values)
    confidence = min(1.0, math.log(total_reviews + 1) / math.log(31))
    return round((mean_positive * confidence + 50 * (1 - confidence)) / 10, 2)
```

- [ ] **Step 2: Create worker/inferencer.py**

```python
import requests
import uuid
import json

# URL sẽ được cập nhật khi bạn cung cấp model mới
HF_SPACE_BASE = "https://ntdat232-absa-electronics-api.hf.space"

def predict_absa(text: str) -> list[dict]:
    """Gọi HuggingFace Space API để lấy kết quả ABSA."""
    session_hash = uuid.uuid4().hex[:8]
    try:
        resp = requests.post(
            f"{HF_SPACE_BASE}/gradio_api/queue/join",
            json={"data": [text.strip()], "fn_index": 0, "session_hash": session_hash},
            headers={"Content-Type": "application/json"}, timeout=15,
        )
        resp.raise_for_status()
        event_id = resp.json().get("event_id")
        if not event_id:
            return []
        stream = requests.get(
            f"{HF_SPACE_BASE}/gradio_api/queue/data",
            params={"session_hash": session_hash}, stream=True, timeout=120,
        )
        for line in stream.iter_lines():
            if not line:
                continue
            decoded = line.decode("utf-8")
            if not decoded.startswith("data:"):
                continue
            payload = json.loads(decoded[5:].strip())
            if payload.get("msg") == "process_completed":
                if not payload.get("success"):
                    return []
                raw = payload["output"]["data"][0]
                return [{"aspect": a.get("category",""), "sentiment": a.get("sentiment",""), "confidence": None} for a in raw]
    except Exception as e:
        print(f"[HF Error] {e}")
    return []

def analyze_reviews(texts: list[str]) -> list[list[dict]]:
    results = []
    for text in texts:
        aspects = predict_absa(text)
        results.append(aspects)
    return results
```

- [ ] **Step 3: Create worker/app.py**

```python
import os
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from typing import Optional
from crawler import search_shopee, search_tiki, crawl_product
from inferencer import analyze_reviews
from scoring import compute_aspect_scores, compute_overall_score

WORKER_API_KEY = os.getenv("WORKER_API_KEY", "worker-secret")

app = FastAPI(title="DevSense Worker")

def check_key(x_worker_key: str = Header(...)):
    if x_worker_key != WORKER_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid key")

class SearchRequest(BaseModel):
    query: str
    num_links: int = 3
    reviews_per_link: int = 50
    platform: str = "shopee"

class LinkRequest(BaseModel):
    url: str
    count: int = 50

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/crawl/search")
def crawl_search(data: SearchRequest, _=None):
    products = []
    if data.platform in ("shopee", "both"):
        products += search_shopee(data.query, data.num_links)
    if data.platform in ("tiki", "both"):
        products += search_tiki(data.query, data.num_links)

    devices = []
    for p in products[:data.num_links]:
        texts = crawl_product(p, data.reviews_per_link)
        aspects_list = analyze_reviews(texts)
        aspect_scores = compute_aspect_scores(aspects_list)
        overall = compute_overall_score(aspect_scores, len(texts))
        devices.append({
            "name": p["name"], "category": "phone",  # worker infers category — can be improved
            "brand": p["name"].split()[0],
            "image_url": p.get("image_url"), "platform": p["platform"],
            "product_url": p["product_url"], "price": p.get("price"),
            "reviews": [{"text": t, "aspects": a} for t, a in zip(texts, aspects_list)],
        })
    return {"devices": devices}

@app.post("/crawl/link")
def crawl_link(data: LinkRequest):
    platform = "shopee" if "shopee.vn" in data.url else "tiki"
    # Parse IDs from URL — basic implementation
    parts = data.url.rstrip("/").split("/")
    if platform == "shopee":
        # shopee URL format: /product/{shop_id}/{item_id}
        item_id = int(parts[-1]) if parts[-1].isdigit() else 0
        shop_id = int(parts[-2]) if len(parts) > 1 and parts[-2].isdigit() else 0
        texts = crawl_product({"platform": "shopee", "shop_id": shop_id, "item_id": item_id}, data.count)
        name = f"Sản phẩm Shopee #{item_id}"
    else:
        # tiki URL: product name ends with p{id}.html
        product_id = 0
        for part in reversed(parts):
            if part.startswith("p") and part.endswith(".html"):
                try: product_id = int(part[1:-5])
                except: pass
        texts = crawl_product({"platform": "tiki", "product_id": product_id, "seller_id": 1}, data.count)
        name = f"Sản phẩm Tiki #{product_id}"

    aspects_list = analyze_reviews(texts)
    aspect_scores = compute_aspect_scores(aspects_list)
    return {"devices": [{
        "name": name, "category": "phone", "brand": "Unknown",
        "platform": platform, "product_url": data.url,
        "reviews": [{"text": t, "aspects": a} for t, a in zip(texts, aspects_list)],
    }]}
```

- [ ] **Step 4: Create worker/requirements.txt**

```
fastapi==0.111.0
uvicorn==0.29.0
pyngrok==7.1.6
selenium==4.21.0
requests==2.31.0
```

- [ ] **Step 5: Create worker/worker_notebook.ipynb**

```json
{
 "cells": [
  {
   "cell_type": "code",
   "metadata": {},
   "source": [
    "# Cell 1: Install dependencies\n",
    "!pip install fastapi uvicorn pyngrok selenium requests -q\n",
    "!pip install -q chromium-driver 2>/dev/null || apt-get install -y chromium-chromedriver -q"
   ]
  },
  {
   "cell_type": "code",
   "metadata": {},
   "source": [
    "# Cell 2: Upload worker files\n",
    "# Upload: app.py, crawler.py, inferencer.py, scoring.py to /content/\n",
    "import os\n",
    "os.chdir('/content')"
   ]
  },
  {
   "cell_type": "code",
   "metadata": {},
   "source": [
    "# Cell 3: Config\n",
    "WORKER_API_KEY = 'worker-secret'  # must match backend config\n",
    "MAIN_API_URL = 'https://YOUR-RAILWAY-APP.railway.app'  # update after Railway deploy\n",
    "NGROK_TOKEN = ''  # get from ngrok.com (free)\n",
    "\n",
    "import os\n",
    "os.environ['WORKER_API_KEY'] = WORKER_API_KEY"
   ]
  },
  {
   "cell_type": "code",
   "metadata": {},
   "source": [
    "# Cell 4: Start FastAPI server in background\n",
    "import threading, uvicorn\n",
    "from app import app\n",
    "\n",
    "def run(): uvicorn.run(app, host='0.0.0.0', port=8001)\n",
    "t = threading.Thread(target=run, daemon=True)\n",
    "t.start()\n",
    "import time; time.sleep(2)\n",
    "print('Worker server started on port 8001')"
   ]
  },
  {
   "cell_type": "code",
   "metadata": {},
   "source": [
    "# Cell 5: Create ngrok tunnel + register with Main API\n",
    "from pyngrok import ngrok, conf\n",
    "import requests\n",
    "\n",
    "conf.get_default().auth_token = NGROK_TOKEN\n",
    "tunnel = ngrok.connect(8001)\n",
    "worker_url = tunnel.public_url\n",
    "print(f'Worker URL: {worker_url}')\n",
    "\n",
    "# Register with Main API\n",
    "r = requests.post(\n",
    "    f'{MAIN_API_URL}/worker/register',\n",
    "    json={'url': worker_url},\n",
    "    headers={'x-worker-key': WORKER_API_KEY}\n",
    ")\n",
    "print(f'Registration: {r.status_code} {r.json()}')"
   ]
  },
  {
   "cell_type": "code",
   "metadata": {},
   "source": [
    "# Cell 6: Keep alive (run this to prevent Colab timeout)\n",
    "import time\n",
    "print('Worker is running. Keep this cell running to stay online.')\n",
    "while True:\n",
    "    time.sleep(60)\n",
    "    print('still alive...')"
   ]
  }
 ],
 "metadata": {
  "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
  "language_info": {"name": "python", "version": "3.10.0"}
 },
 "nbformat": 4,
 "nbformat_minor": 4
}
```

- [ ] **Step 6: Commit**

```bash
git add worker/
git commit -m "feat: colab worker (scrapers, inference, FastAPI, notebook)"
```

---

## Phase 4 — Deploy

### Task 15: Railway deployment

**Files:**
- Create: `backend/Dockerfile`
- Create: `frontend/Dockerfile`
- Create: `backend/.env.example`

- [ ] **Step 1: Create backend/Dockerfile**

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Create frontend/Dockerfile**

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

- [ ] **Step 3: Create frontend/nginx.conf**

```nginx
server {
    listen 80;
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }
}
```

- [ ] **Step 4: Create backend/.env.example**

```
DATABASE_URL=postgresql://user:pass@host/dbname
SECRET_KEY=generate-a-random-64-char-string
WORKER_API_KEY=choose-a-secret-key
```

- [ ] **Step 5: Deploy backend to Railway**

1. Push code to GitHub
2. New project on Railway → Deploy from GitHub → select `backend/` folder
3. Add PostgreSQL plugin to same project
4. Set env vars: `DATABASE_URL` (auto from plugin), `SECRET_KEY`, `WORKER_API_KEY`
5. Note the Railway backend URL (e.g. `https://devsense-backend.railway.app`)

- [ ] **Step 6: Deploy frontend to Railway**

1. New service in same Railway project → select `frontend/` folder
2. Set env var: `VITE_API_URL=https://devsense-backend.railway.app`
3. Rebuild and deploy
4. Note the frontend URL

- [ ] **Step 7: Update Colab notebook**

In `worker_notebook.ipynb` Cell 3, update:
```python
MAIN_API_URL = 'https://devsense-backend.railway.app'  # your actual Railway URL
```

- [ ] **Step 8: Run full E2E test**

1. Start Colab notebook (all cells)
2. Open frontend URL
3. Register an account
4. Go to Search → search "iPhone 15" → should trigger crawl
5. Verify device appears in Kho DB
6. Verify favorites and history work

- [ ] **Step 9: Final commit**

```bash
git add .
git commit -m "feat: railway deployment config"
```

---

## Self-Review Notes

- `crawl/router.py` uses `get_current_user.__wrapped__` as a workaround for optional auth — this is fragile. The correct pattern is to make auth optional with `Optional[HTTPAuthorizationCredentials]` in the dependency. Revisit if auth dependency causes issues.
- Worker category detection in `app.py` hardcodes `"phone"` — should be improved to detect from product name (laptop keywords: "laptop", "macbook", "thinkpad", "zenbook").
- Colab Selenium may need additional setup depending on Colab's Chrome version — the notebook Cell 1 handles this with apt-get fallback.
