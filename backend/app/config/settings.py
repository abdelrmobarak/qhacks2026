from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "QHacks 2026 API"
    app_version: str = "0.1.0"
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = 8000

    cors_origins: list[str] = ["http://localhost:3000"]

    # database_url: str = "postgresql+asyncpg://user:pass@localhost:5432/dbname"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
