import os

os.environ.setdefault("JWT_SECRET", "test-secret-test-secret-test-secret-123")

import mongomock  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import get_db  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture
def client():
    db = mongomock.MongoClient()["test"]
    app.dependency_overrides[get_db] = lambda: db
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers(client):
    r = client.post("/auth/signup", json={"email": "a@example.com", "password": "password123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}
