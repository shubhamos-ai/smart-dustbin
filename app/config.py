from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    FIREBASE_DB_URL: Optional[str] = None
    DATABASE_URL: Optional[str] = None
    API_KEY: Optional[str] = None
    FIREBASE_CREDENTIALS_PATH: str = "firebase-credentials.json"
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "allow"  # Allow extra fields from .env

settings = Settings()

# Use DATABASE_URL as FIREBASE_DB_URL if not set
if not settings.FIREBASE_DB_URL and settings.DATABASE_URL:
    settings.FIREBASE_DB_URL = settings.DATABASE_URL
