import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    PROJECT_NAME: str = "Supply Chain X Autonomous API"
    API_V1_STR: str = "/api"
    HOST: str = "0.0.0.0"
    PORT: int = int(os.environ.get("PORT", 8000))
    DATABASE_URL: str = os.environ.get(
        "DATABASE_URL",
        "sqlite:///./supply_chain.db"
    )
    CORS_ORIGINS: str = os.environ.get(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:3000,https://*.onrender.com,https://*.vercel.app,*"
    )
    OPENWEATHER_API_KEY: str = os.environ.get("OPENWEATHER_API_KEY", "")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

    @property
    def cors_origins_list(self) -> List[str]:
        origins = [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
        if "*" in origins:
            return ["*"]
        return origins


settings = Settings()
