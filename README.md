# Mini Tasks

A task manager: sign up / sign in, create / update / delete tasks, filter by status or "due this week".

| | URL |
|---|---|
| Web app | `https://mini-tasks-web.onrender.com` |
| API base | `https://mini-tasks-x74e.onrender.com` (docs at `/docs`, health at `/health`) |
| Demo user | `demo@minitasks.dev` / `DemoPass123!` (non-admin) |

## Stack
Next.js 14 (App Router, JavaScript) · FastAPI (Python 3.12) · MongoDB · JWT (PyJWT) + bcrypt

## Architecture

```mermaid
flowchart LR
  U[Browser] -->|HTTPS| FE[Next.js frontend]
  FE -->|REST JSON + Bearer JWT| API[FastAPI backend]
  API -->|PyMongo| DB[(MongoDB)]
  API -->|server-side key| AI[OpenAI API]
```

```
backend/app/
  main.py        app, CORS, security headers, /health
  config.py      env-based settings
  security.py    bcrypt hashing + JWT
  deps.py        get_current_user dependency
  schemas.py     Pydantic validation models
  routers/       auth.py, tasks.py, ai.py
frontend/
  app/           pages: /login /signup /dashboard
  components/    AuthForm, TaskForm
  lib/api.ts     typed fetch wrapper + session helpers
```

### API
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/signup` | 201, 409 duplicate email, 422 validation, 429 rate limited |
| POST | `/auth/login` | 200, 401 invalid credentials, 429 after 10 failures / 5 min |
| GET | `/auth/me` | current user |
| GET | `/tasks?status=&due_this_week=&today=` | only the caller's tasks; `today` (YYYY-MM-DD) is the browser's local date so "this week" matches the user's timezone |
| POST | `/tasks` | 201 |
| GET / PATCH / DELETE | `/tasks/{id}` | 404 if missing or not yours; DELETE → 204 |
| GET | `/ai/status` | `{enabled}`; the UI hides the AI button when no key is set |
| POST | `/ai/suggest-due-date` | `{title, description}` → `{due_date, reason}` (503 if no key, 502 on upstream failure) |
| GET | `/health` | pings MongoDB |

## Run locally

### Option A: Docker
```bash
export OPENAI_API_KEY=sk-...   # optional
docker compose up --build
# web: http://localhost:3000   api: http://localhost:8000/docs
docker compose exec backend python -m scripts.seed_demo   # create demo user
```

### Option B: manually
```bash
# Backend (needs a MongoDB on localhost:27017 or an Atlas URI)
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env                                  # edit values
uvicorn app.main:app --reload                         # http://localhost:8000
python -m scripts.seed_demo                           # optional demo user

# Frontend
cd frontend
cp .env.example .env.local
npm install
npm run dev                                           # http://localhost:3000
```

### Tests and linting
```bash
cd backend
pytest -q                   # 13 tests, uses mongomock (no DB needed)
ruff check . && ruff format --check .

cd frontend
npm test                    # 4 tests (Vitest)
npm run lint && npm run build
```
CI (`.github/workflows/ci.yml`) runs all of these on every push.

## Environment variables

**Backend** (`backend/.env.example`)
| Var | Purpose |
|---|---|
| `MONGO_URI`, `MONGO_DB` | MongoDB connection |
| `JWT_SECRET` | **Required in production** (app refuses to start without it when `ENV=production`) |
| `JWT_EXPIRE_MINUTES` | token lifetime (default 60) |
| `CORS_ORIGINS` | comma-separated allowed frontend origins |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | optional AI feature; key stays server-side |
| `ENV` | set to `production` when deployed |

**Frontend**: `NEXT_PUBLIC_API_URL`. It is baked in at build time, so set it before building.

## Deployment (Render)
Two Docker web services plus MongoDB Atlas (free M0).
1. **Backend**: New Web Service, runtime Docker, Dockerfile path `./backend/Dockerfile`, build context `./backend`, health check path `/health`.
   Env vars: `MONGO_URI`, `MONGO_DB=minitasks`, `JWT_SECRET` (long random), `ENV=production`, `CORS_ORIGINS=<frontend URL, no trailing slash>`, optional `OPENAI_API_KEY`.
2. **Frontend**: New Web Service, runtime Docker, Dockerfile path `./frontend/Dockerfile`, build context `./frontend`. Env var `NEXT_PUBLIC_API_URL=<backend URL, no trailing slash>` (build-time; redeploy after changing it).
3. Deploy the backend first, then the frontend, then set the frontend URL in the backend's `CORS_ORIGINS` and redeploy the backend.
4. Seed the demo user once against the same Atlas database: `cd backend && python -m scripts.seed_demo`.

Note: Render's free instances sleep after ~15 idle minutes, so the first request after a pause can take about a minute.

## Deployment (alternative: DigitalOcean App Platform)
1. Create a MongoDB Atlas free cluster (or a DO Managed MongoDB); allow network access; copy the connection string.
2. Push this repo to GitHub. In DO, create an App with two components from the repo:
   - **backend**: source dir `backend`, Dockerfile build, HTTP port 8000, health check path `/health`. Set env vars above (`ENV=production`, strong `JWT_SECRET`, `MONGO_URI`, `CORS_ORIGINS=https://<frontend-url>`, `OPENAI_API_KEY`).
   - **frontend**: source dir `frontend`, Dockerfile build, HTTP port 3000. Set build-time var `NEXT_PUBLIC_API_URL=https://<backend-url>`.
3. Deploy backend first to get its URL, then set it on the frontend, then add the frontend URL to the backend's `CORS_ORIGINS`.
4. Seed the demo user once (DO console on backend): `python -m scripts.seed_demo`.

## Security notes
- Passwords hashed with bcrypt (salted); 8–72 char limit (bcrypt's 72-byte cap).
- JWT HS256, 60 min expiry, secret from env; login returns the same error for unknown email / wrong password.
- Every task query is scoped by `user_id`, so users cannot read or modify each other's tasks (404, not 403).
- CORS restricted to configured origins and methods; security headers on API and frontend; no secrets in the repo.
- Input validated by Pydantic (lengths, enums, dates, email).

## Tradeoffs & future improvements
- **JWT in localStorage**: simple and works across two domains, but exposed to XSS. Better: httpOnly, SameSite cookies with a shared parent domain/proxy plus CSRF protection, and refresh tokens.
- **Dates stored as ISO strings** (`YYYY-MM-DD`): easy range queries, no timezone surprises for date-only values; "this week" uses the server's date (Mon–Sun).
- **Rate limiting is in-memory** (login: 10 failures / 5 min per IP+email; signup: 20 / hour per IP). It resets on restart and is per-instance; with several instances I would move it to Redis. The AI endpoint is auth-protected but not separately rate limited.
- **Free-tier cold starts**: the free backend sleeps when idle, so the first request can be slow.
- **Sync PyMongo** in FastAPI's threadpool instead of Motor, for simplicity; async driver would scale better.
- **Realtime**: optimistic UI is implemented for status change and delete (with rollback); SSE/WebSocket sync across tabs is future work.
- **Testing**: backend API tests use mongomock; the frontend has unit tests for the API client only. Next would be component tests (Testing Library) and Playwright e2e.
- Pagination, task search, email verification and password reset are not implemented.
