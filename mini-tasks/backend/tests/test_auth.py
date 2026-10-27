def test_signup_login_me(client):
    r = client.post("/auth/signup", json={"email": "New@Example.com", "password": "password123"})
    assert r.status_code == 201
    assert r.json()["user"]["email"] == "new@example.com"

    r = client.post("/auth/login", json={"email": "new@example.com", "password": "password123"})
    assert r.status_code == 200
    token = r.json()["access_token"]

    r = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200 and r.json()["email"] == "new@example.com"


def test_duplicate_and_bad_credentials(client):
    body = {"email": "x@example.com", "password": "password123"}
    assert client.post("/auth/signup", json=body).status_code == 201
    assert client.post("/auth/signup", json=body).status_code == 409
    assert client.post("/auth/login", json={**body, "password": "nope-nope"}).status_code == 401


def test_validation_and_protected_routes(client):
    assert client.post("/auth/signup", json={"email": "bad", "password": "password123"}).status_code == 422
    assert client.post("/auth/signup", json={"email": "a@b.co", "password": "short"}).status_code == 422
    assert client.get("/tasks").status_code == 401


def test_login_is_rate_limited_after_repeated_failures(client):
    client.post("/auth/signup", json={"email": "rl@example.com", "password": "password123"})
    bad = {"email": "rl@example.com", "password": "wrong-password"}
    for _ in range(10):
        assert client.post("/auth/login", json=bad).status_code == 401
    assert client.post("/auth/login", json=bad).status_code == 429
    # Even the right password is blocked until the window passes
    good = {"email": "rl@example.com", "password": "password123"}
    assert client.post("/auth/login", json=good).status_code == 429
