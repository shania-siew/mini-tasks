import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    env: str = os.getenv("ENV", "development")
    mongo_uri: str = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    mongo_db: str = os.getenv("MONGO_DB", "minitasks")
    jwt_expire_minutes: int = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))
    cors_origins: list[str] = [
        o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()
    ]
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    def __init__(self) -> None:
        secret = os.getenv("JWT_SECRET", "")
        if not secret:
            if self.env == "production":
                raise RuntimeError("JWT_SECRET must be set in production")
            secret = "dev-only-insecure-secret-do-not-use-in-prod"
        self.jwt_secret = secret


settings = Settings()
