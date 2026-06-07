from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///data.db"
    cors_origins: list[str] = ["http://localhost:5173"]
    permission_timeout: int = 300
    max_image_size: int = 10 * 1024 * 1024
    max_images_per_message: int = 5
    max_turns: int = 50

    max_file_read_size: int = 1024 * 1024  # 1 MB
    terminal_buffer_size: int = 65536  # 64 KB
    terminal_default_cols: int = 80
    terminal_default_rows: int = 24
    summary_max_chars: int = 100_000
    summary_max_tokens: int = 500

    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
