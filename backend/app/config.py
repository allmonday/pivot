from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///data.db"
    cors_origins: list[str] = ["http://localhost:5173"]
    permission_timeout: int = 300
    max_image_size: int = 10 * 1024 * 1024
    max_images_per_message: int = 5
    max_turns: int = 50

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
