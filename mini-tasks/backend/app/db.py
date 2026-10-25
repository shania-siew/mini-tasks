from pymongo import ASCENDING, MongoClient
from pymongo.database import Database

from app.config import settings

_client: MongoClient | None = None


def get_db() -> Database:
    global _client
    if _client is None:
        _client = MongoClient(settings.mongo_uri, serverSelectionTimeoutMS=5000)
    return _client[settings.mongo_db]


def ensure_indexes() -> None:
    db = get_db()
    db.users.create_index("email", unique=True)
    db.tasks.create_index([("user_id", ASCENDING), ("due_date", ASCENDING)])
