from models import Device, CategoryEnum, PlatformEnum, SourceEnum
from config import settings

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
