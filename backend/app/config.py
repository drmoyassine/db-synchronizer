"""
Application configuration using pydantic-settings
"""

from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Database
    database_url: str = "sqlite+aiosqlite:///./data/config.db"
    
    # Security
    secret_key: str = "dev-secret-key-change-in-production"
    
    # CORS
    cors_origins: List[str] = ["http://localhost:5173", "http://localhost:3000"]
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8001
    debug: bool = False
    
    # Redis (for Celery)
    redis_url: str = "redis://localhost:6379/0"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
