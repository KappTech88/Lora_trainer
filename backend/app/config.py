import re
from pathlib import Path

from pydantic_settings import BaseSettings

ENV_FILE_PATH = Path(__file__).resolve().parent.parent.parent / ".env"


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
    webhook_secret: str = ""

    model_config = {
        "env_file": str(ENV_FILE_PATH),
        "env_file_encoding": "utf-8",
    }


settings = Settings()


def persist_api_key(api_key: str) -> None:
    """Write the API key back to the .env file so it survives restarts."""
    env_path = ENV_FILE_PATH
    if env_path.exists():
        content = env_path.read_text()
        # Replace existing MODELSLAB_API_KEY line
        if re.search(r"^MODELSLAB_API_KEY=", content, flags=re.MULTILINE):
            content = re.sub(
                r"^MODELSLAB_API_KEY=.*$",
                f"MODELSLAB_API_KEY={api_key}",
                content,
                flags=re.MULTILINE,
            )
        else:
            content = content.rstrip("\n") + f"\nMODELSLAB_API_KEY={api_key}\n"
    else:
        content = f"MODELSLAB_API_KEY={api_key}\n"
    env_path.write_text(content)
