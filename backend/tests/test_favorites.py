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
