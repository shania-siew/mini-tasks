from app.config import settings


def test_ai_status_reflects_configuration(client, monkeypatch):
    monkeypatch.setattr(settings, "openai_api_key", "")
    assert client.get("/ai/status").json() == {"enabled": False}
    monkeypatch.setattr(settings, "openai_api_key", "sk-test")
    assert client.get("/ai/status").json() == {"enabled": True}


def test_suggest_requires_auth_and_key(client, auth_headers, monkeypatch):
    body = {"title": "t", "description": "finish the report by friday"}
    assert client.post("/ai/suggest-due-date", json=body).status_code == 401
    monkeypatch.setattr(settings, "openai_api_key", "")
    assert client.post("/ai/suggest-due-date", json=body, headers=auth_headers).status_code == 503
