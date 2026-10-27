from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from app.db import get_db
from app.deps import get_current_user
from app.ratelimit import RateLimiter
from app.schemas import LoginIn, SignupIn, TokenOut, UserOut
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

# 10 failed logins per IP+email per 5 minutes; 20 signups per IP per hour
login_limiter = RateLimiter(max_attempts=10, window_seconds=300)
signup_limiter = RateLimiter(max_attempts=20, window_seconds=3600)


def client_ip(request: Request) -> str:
    # Behind a proxy (Render/DO) the real client is the first X-Forwarded-For entry
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def too_many() -> HTTPException:
    return HTTPException(
        status.HTTP_429_TOO_MANY_REQUESTS,
        "Too many attempts. Please wait a few minutes and try again.",
        headers={"Retry-After": "300"},
    )


@router.post("/signup", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def signup(body: SignupIn, request: Request, db: Database = Depends(get_db)):
    ip = client_ip(request)
    if signup_limiter.blocked(ip):
        raise too_many()
    signup_limiter.hit(ip)

    email = body.email.lower()
    conflict = HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    if db.users.find_one({"email": email}):
        raise conflict
    try:
        res = db.users.insert_one(
            {
                "email": email,
                "password_hash": hash_password(body.password),
                "created_at": datetime.now(timezone.utc),
            }
        )
    except DuplicateKeyError:
        raise conflict from None
    uid = str(res.inserted_id)
    return TokenOut(access_token=create_access_token(uid), user=UserOut(id=uid, email=email))


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, request: Request, db: Database = Depends(get_db)):
    email = body.email.lower()
    key = f"{client_ip(request)}:{email}"
    if login_limiter.blocked(key):
        raise too_many()

    user = db.users.find_one({"email": email})
    # Same error for unknown email / wrong password to avoid user enumeration
    if not user or not verify_password(body.password, user["password_hash"]):
        login_limiter.hit(key)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")

    login_limiter.reset(key)
    uid = str(user["_id"])
    return TokenOut(access_token=create_access_token(uid), user=UserOut(id=uid, email=user["email"]))


@router.get("/me", response_model=UserOut)
def me(user: dict = Depends(get_current_user)):
    return user
