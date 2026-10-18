"""Plan2Space 3D configuration module using pydantic-settings."""

from pathlib import Path
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Plan2Space 3D"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api/v1"

    # Base storage directory
    DATA_DIR: Path = Path("data")
    UPLOADS_DIR: Path = Path("data/uploads")
    MODELS_DIR: Path = Path("data/models")
    JOBS_DIR: Path = Path("data/jobs")
    SAMPLES_DIR: Path = Path("sample_floorplans")

    # Optional Features
    ENABLE_OCR: bool = False

    # Limits
    MAX_UPLOAD_SIZE_BYTES: int = 25 * 1024 * 1024  # 25 MB
    MAX_IMAGE_DIMENSION_PX: int = 8192
    ALLOWED_IMAGE_TYPES: List[str] = [
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp",
    ]

    # Geometry Defaults (all in metres)
    DEFAULT_WALL_HEIGHT: float = 2.7
    DEFAULT_EXTERIOR_WALL_THICKNESS: float = 0.23
    DEFAULT_INTERIOR_WALL_THICKNESS: float = 0.115
    DEFAULT_FLOOR_THICKNESS: float = 0.15
    DEFAULT_DOOR_WIDTH: float = 0.9
    DEFAULT_DOOR_HEIGHT: float = 2.1
    DEFAULT_WINDOW_WIDTH: float = 1.2
    DEFAULT_WINDOW_HEIGHT: float = 1.2
    DEFAULT_WINDOW_SILL: float = 0.9
    DEFAULT_PLAN_LONGEST_SIDE_M: float = 12.0

    # API Security (optional, if set checks X-API-Key)
    API_KEY: Optional[str] = None
    CORS_ORIGINS: List[str] = ["*"]

    # Concurrency
    MAX_WORKER_THREADS: int = 4

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

# Ensure directories exist
for directory in (settings.DATA_DIR, settings.UPLOADS_DIR, settings.MODELS_DIR, settings.JOBS_DIR):
    directory.mkdir(parents=True, exist_ok=True)
