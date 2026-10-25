from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from app.db import get_db
from app.deps import get_current_user
from app.schemas import LoginIn, SignupIn, TokenOut, UserOut
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def signup(body: SignupIn, db: Database = Depends(get_db)):
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
        raise conflict
    uid = str(res.inserted_id)
    return TokenOut(access_token=create_access_token(uid), user=UserOut(id=uid, email=email))


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Database = Depends(get_db)):
    user = db.users.find_one({"email": body.email.lower()})
    # Same error for unknown email / wrong password to avoid user enumeration
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    uid = str(user["_id"])
    return TokenOut(access_token=create_access_token(uid), user=UserOut(id=uid, email=user["email"]))


@router.get("/me", response_model=UserOut)
def me(user: dict = Depends(get_current_user)):
    return user
