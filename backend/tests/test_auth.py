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
