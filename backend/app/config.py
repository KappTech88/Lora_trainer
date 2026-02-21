from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    modelslab_api_key: str = ""
    database_path: str = "./storage/facelock.db"
    image_storage_path: str = "./storage"
    default_model_id: str = "sdxl"
    default_lora_base: str = "sdxl"
    default_guidance_scale: float = 7.5
    default_num_steps: int = 31
    default_width: int = 1024
    default_height: int = 1024

    model_config = {
        "env_file": str(Path(__file__).resolve().parent.parent.parent / ".env"),
        "env_file_encoding": "utf-8",
    }


settings = Settings()
