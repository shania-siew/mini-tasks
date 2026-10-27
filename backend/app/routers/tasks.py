from datetime import date, datetime, timedelta, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pymongo.database import Database

from app.db import get_db
from app.deps import get_current_user
from app.schemas import Status, TaskCreate, TaskOut, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["tasks"])


def to_out(doc: dict) -> TaskOut:
    return TaskOut(
        id=str(doc["_id"]),
        title=doc["title"],
        description=doc.get("description", ""),
        priority=doc["priority"],
        status=doc["status"],
        due_date=doc.get("due_date"),
    )


def parse_id(task_id: str) -> ObjectId:
    try:
        return ObjectId(task_id)
    except InvalidId:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found") from None


def week_bounds(today: date) -> tuple[str, str]:
    """Monday..Sunday of the current week as ISO date strings."""
    start = today - timedelta(days=today.weekday())
    return start.isoformat(), (start + timedelta(days=6)).isoformat()


@router.get("", response_model=list[TaskOut])
def list_tasks(
    status_filter: Status | None = Query(default=None, alias="status"),
    due_this_week: bool = False,
    # The browser sends its own local date so "this week" matches the user's timezone
    today: date | None = None,
    user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    query: dict = {"user_id": user["id"]}
    if status_filter:
        query["status"] = status_filter
    if due_this_week:
        start, end = week_bounds(today or date.today())
        query["due_date"] = {"$gte": start, "$lte": end}
    docs = list(db.tasks.find(query))
    # Tasks with due dates first (soonest first), then undated ones
    docs.sort(key=lambda d: (d.get("due_date") is None, d.get("due_date") or ""))
    return [to_out(d) for d in docs]


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(body: TaskCreate, user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    doc = body.model_dump()
    doc["due_date"] = body.due_date.isoformat() if body.due_date else None
    doc["user_id"] = user["id"]
    doc["created_at"] = datetime.now(timezone.utc)
    doc["_id"] = db.tasks.insert_one(doc).inserted_id
    return to_out(doc)


def get_owned(db: Database, task_id: str, user_id: str) -> dict:
    doc = db.tasks.find_one({"_id": parse_id(task_id), "user_id": user_id})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    return doc


@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: str, user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    return to_out(get_owned(db, task_id, user["id"]))


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(
    task_id: str, body: TaskUpdate, user: dict = Depends(get_current_user), db: Database = Depends(get_db)
):
    get_owned(db, task_id, user["id"])
    changes = body.model_dump(exclude_unset=True)
    # Only due_date may be explicitly null (clears it)
    changes = {k: v for k, v in changes.items() if v is not None or k == "due_date"}
    if "due_date" in changes and changes["due_date"] is not None:
        changes["due_date"] = changes["due_date"].isoformat()
    if changes:
        db.tasks.update_one({"_id": parse_id(task_id)}, {"$set": changes})
    return to_out(get_owned(db, task_id, user["id"]))


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: str, user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    res = db.tasks.delete_one({"_id": parse_id(task_id), "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
