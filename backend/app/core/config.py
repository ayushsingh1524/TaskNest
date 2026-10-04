import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "TaskNest"
    API_V1_STR: str = "/api/v1"
    
    # DATABASE
    POSTGRES_USER: str = "user"
    POSTGRES_PASSWORD: str = "password"
    POSTGRES_DB: str = "tasknest"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: str = "5432"
    
    DATABASE_URL: str = ""

    # JWT SECURITY
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # REDIS
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # OAUTH
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    FRONTEND_URL: str = "http://localhost:3000"
    COOKIE_SECURE: bool = False
    GITHUB_WEBHOOK_SECRET: str = ""
    GITHUB_TOKEN_ENCRYPTION_KEY: str = ""
    
    # SMTP EMAIL
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_NAME: str = "TaskNest"
    
    class Config:
        case_sensitive = True
        env_file = ".env"
        env_file_encoding = "utf-8"

    def get_database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        if self.POSTGRES_PASSWORD:
            return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        return f"postgresql+asyncpg://{self.POSTGRES_USER}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

settings = Settings()
if not settings.SECRET_KEY:
    settings.SECRET_KEY = "tasknest-local-development-only"
settings.DATABASE_URL = settings.get_database_url()
