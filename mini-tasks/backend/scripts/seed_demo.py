"""Create the demo (non-admin) user: python -m scripts.seed_demo"""

from datetime import datetime, timezone

from app.db import ensure_indexes, get_db
from app.security import hash_password

EMAIL, PASSWORD = "demo@minitasks.dev", "DemoPass123!"

if __name__ == "__main__":
    ensure_indexes()
    db = get_db()
    if db.users.find_one({"email": EMAIL}):
        print("Demo user already exists")
    else:
        db.users.insert_one(
            {
                "email": EMAIL,
                "password_hash": hash_password(PASSWORD),
                "created_at": datetime.now(timezone.utc),
            }
        )
        print(f"Created {EMAIL} / {PASSWORD}")
