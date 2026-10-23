import os
from pathlib import Path
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseModel):
    PROJECT_NAME: str = "Loaf n Leaf Restaurant Management System"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Authoritative Secret Key for JWT / HMAC
    SECRET_KEY: str = os.getenv("SECRET_KEY", "loaf-n-leaf-pos-secure-key-2026-auth-092215")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Primary Database URL (Supports PostgreSQL in production or local SQLite)
    # e.g., postgresql://postgres:password@localhost:5432/loafnleaf
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        f"sqlite:///{BASE_DIR}/data/restaurant.db"
    )
    
    # Cloud Synchronization (Supabase)
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "")
    ENABLE_CLOUD_SYNC: bool = os.getenv("ENABLE_CLOUD_SYNC", "false").lower() == "true"
    
    # Regional Settings
    DEFAULT_CURRENCY: str = "PKR"
    CURRENCY_SYMBOL: str = "Rs."
    TIMEZONE: str = "Asia/Karachi"
    DEFAULT_TAX_RATE: float = 13.0  # Sindh Sales Tax (SRB)
    
    # Device Security Policy
    DEFAULT_MAX_DEVICES_PER_EMPLOYEE: int = 2
    CHALLENGE_EXPIRE_SECONDS: int = 60

settings = Settings()

# Ensure local data directory exists if using SQLite
if settings.DATABASE_URL.startswith("sqlite"):
    data_dir = BASE_DIR / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
