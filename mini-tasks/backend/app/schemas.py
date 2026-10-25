from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

Priority = Literal["low", "medium", "high"]
Status = Literal["todo", "in_progress", "done"]


class SignupIn(BaseModel):
    email: EmailStr
    # bcrypt only uses the first 72 bytes, so cap the length
    password: str = Field(min_length=8, max_length=72)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


class UserOut(BaseModel):
    id: str
    email: EmailStr


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=2000)
    priority: Priority = "medium"
    status: Status = "todo"
    due_date: Optional[date] = None

    @field_validator("title")
    @classmethod
    def strip_title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("title must not be blank")
        return v


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=2000)
    priority: Optional[Priority] = None
    status: Optional[Status] = None
    due_date: Optional[date] = None  # send null explicitly to clear


class TaskOut(BaseModel):
    id: str
    title: str
    description: str
    priority: Priority
    status: Status
    due_date: Optional[date]


class SuggestIn(BaseModel):
    title: str = Field(default="", max_length=120)
    description: str = Field(min_length=3, max_length=2000)


class SuggestOut(BaseModel):
    due_date: date
    reason: str
