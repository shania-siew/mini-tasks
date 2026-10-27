from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pymongo.database import Database

from app.config import settings
from app.db import ensure_indexes, get_db
from app.routers import ai, auth, tasks


@asynccontextmanager
async def lifespan(_: FastAPI):
    ensure_indexes()
    yield


app = FastAPI(title="Mini Tasks API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/health", tags=["meta"])
def health(db: Database = Depends(get_db)):
    try:
        db.command("ping")
    except Exception:
        raise HTTPException(503, "Database unavailable") from None
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(tasks.router)
app.include_router(ai.router)
