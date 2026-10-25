from datetime import date, timedelta


def make(client, headers, **kw):
    body = {"title": "Task", **kw}
    r = client.post("/tasks", json=body, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def test_crud(client, auth_headers):
    t = make(client, auth_headers, title="Write docs", priority="high")
    assert t["status"] == "todo"

    r = client.patch(f"/tasks/{t['id']}", json={"status": "done", "due_date": "2030-01-02"}, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "done" and r.json()["due_date"] == "2030-01-02"

    r = client.patch(f"/tasks/{t['id']}", json={"due_date": None}, headers=auth_headers)
    assert r.json()["due_date"] is None

    assert client.delete(f"/tasks/{t['id']}", headers=auth_headers).status_code == 204
    assert client.get(f"/tasks/{t['id']}", headers=auth_headers).status_code == 404


def test_filters(client, auth_headers):
    today = date.today()
    make(client, auth_headers, title="soon", due_date=(today).isoformat())
    make(client, auth_headers, title="later", due_date=(today + timedelta(days=60)).isoformat(), status="done")

    week = client.get("/tasks?due_this_week=true", headers=auth_headers).json()
    assert [t["title"] for t in week] == ["soon"]
    done = client.get("/tasks?status=done", headers=auth_headers).json()
    assert [t["title"] for t in done] == ["later"]
    assert client.get("/tasks?status=bogus", headers=auth_headers).status_code == 422


def test_users_cannot_see_each_others_tasks(client, auth_headers):
    t = make(client, auth_headers)
    other = client.post("/auth/signup", json={"email": "b@example.com", "password": "password123"})
    h2 = {"Authorization": f"Bearer {other.json()['access_token']}"}
    assert client.get("/tasks", headers=h2).json() == []
    assert client.delete(f"/tasks/{t['id']}", headers=h2).status_code == 404


def test_task_validation(client, auth_headers):
    assert client.post("/tasks", json={"title": "   "}, headers=auth_headers).status_code == 422
    assert client.post("/tasks", json={"title": "x", "priority": "urgent"}, headers=auth_headers).status_code == 422
