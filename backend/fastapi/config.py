from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://ediscovery_user:securepass123@localhost:5432/ediscovery_db"
    
    # API Configuration
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    
    # Node.js Backend
    nodejs_backend_url: str = "http://localhost:4443"
    
    # JWT Configuration
    secret_key: str = "your-secret-key-here-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # File Storage
    upload_dir: str = "../uploads"
    export_dir: str = "./exports"
    max_file_size: int = 100 * 1024 * 1024  # 100MB
    
    class Config:
        env_file = ".env"

settings = Settings()
