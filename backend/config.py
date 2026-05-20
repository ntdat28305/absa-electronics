from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = "sqlite:///./devsense.db"
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_days: int = 7
    worker_api_key: str = "worker-secret"

    class Config:
        env_file = ".env"

settings = Settings()
