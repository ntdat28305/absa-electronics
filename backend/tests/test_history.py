from models import Device, CategoryEnum, SourceEnum
from history.service import save_history

def _register_and_login(client):
    client.post("/auth/register", json={"email": "h@b.com", "password": "pass", "display_name": "H"})
    r = client.post("/auth/login", json={"email": "h@b.com", "password": "pass"})
    return r.json()["access_token"]

def _seed_device(db):
    d = Device(name="MacBook Air", category=CategoryEnum.laptop, brand="Apple",
               overall_score=9.0, total_reviews_analyzed=50, source=SourceEnum.db_preset)
    db.add(d)
    db.commit()
    db.refresh(d)
    return d

def test_history_empty(client, db):
    token = _register_and_login(client)
    r = client.get("/history", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["total"] == 0

def test_history_after_save(client, db):
    token = _register_and_login(client)
    headers = {"Authorization": f"Bearer {token}"}
    # Get user id
    me = client.get("/auth/me", headers=headers).json()
    d = _seed_device(db)
    save_history(db, me["id"], d.id, "search", "MacBook Air")
    r = client.get("/history", headers=headers)
    assert r.json()["total"] == 1
    assert r.json()["items"][0]["input_query"] == "MacBook Air"
