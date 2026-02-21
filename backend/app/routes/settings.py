from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.database import get_db
from app.models.schemas import ApiKeyUpdate, SettingsResponse

router = APIRouter()


def get_modelslab_client():
    from app.main import modelslab_client
    return modelslab_client


@router.get("", response_model=SettingsResponse)
async def get_settings():
    return SettingsResponse(
        has_api_key=bool(settings.modelslab_api_key),
        default_model_id=settings.default_model_id,
        default_lora_base=settings.default_lora_base,
        default_guidance_scale=settings.default_guidance_scale,
        default_num_steps=settings.default_num_steps,
        default_width=settings.default_width,
        default_height=settings.default_height,
    )


@router.put("/api-key")
async def update_api_key(data: ApiKeyUpdate):
    settings.modelslab_api_key = data.api_key
    client = get_modelslab_client()
    client.update_api_key(data.api_key)
    return {"status": "success", "message": "API key updated"}
