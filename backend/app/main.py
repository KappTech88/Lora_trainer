import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.database import PromptPreset, async_session, get_db, init_db
from app.models.schemas import PromptPresetResponse
from app.routes import characters, gallery, generate, settings as settings_route
from app.routes import training, webhooks
from app.services.image_storage import ImageStorageService
from app.services.modelslab_client import ModelsLabClient
from app.services.polling_service import PollingService
from app.services.training_service import TrainingService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global service instances
modelslab_client = ModelsLabClient()
image_storage = ImageStorageService()
polling_service = PollingService(modelslab_client, image_storage)
training_service = TrainingService(modelslab_client, image_storage)

DEFAULT_PRESETS = [
    {
        "name": "Professional Headshot",
        "category": "headshot",
        "prompt_template": "professional headshot photo of {trigger_word} person, studio lighting, neutral background, business attire, sharp focus, 8k, photorealistic",
        "negative_prompt": "cartoon, anime, blurry, bad anatomy, deformed, ugly, low quality, extra limbs",
    },
    {
        "name": "Fantasy Portrait",
        "category": "fantasy",
        "prompt_template": "epic fantasy portrait of {trigger_word} person as a warrior, ornate armor, dramatic lighting, magical aura, cinematic, 8k, detailed",
        "negative_prompt": "modern clothing, blurry, bad anatomy, deformed, low quality",
    },
    {
        "name": "Casual Lifestyle",
        "category": "lifestyle",
        "prompt_template": "candid photo of {trigger_word} person in casual clothing, natural outdoor setting, golden hour lighting, lifestyle photography, 8k",
        "negative_prompt": "studio, artificial, blurry, deformed, ugly",
    },
    {
        "name": "Anime Style",
        "category": "anime",
        "prompt_template": "anime illustration of {trigger_word} person, vibrant colors, detailed eyes, clean linework, studio ghibli style, beautiful",
        "negative_prompt": "photorealistic, blurry, bad anatomy, western cartoon, low quality",
    },
    {
        "name": "Action Hero",
        "category": "action",
        "prompt_template": "cinematic action shot of {trigger_word} person, dynamic pose, dramatic lighting, movie poster style, detailed, epic, 8k",
        "negative_prompt": "static, boring, blurry, deformed, low quality, bad anatomy",
    },
    {
        "name": "Book Cover Author",
        "category": "author",
        "prompt_template": "author portrait of {trigger_word} person, thoughtful expression, moody lighting, bookshelf background, literary atmosphere, professional photography, 8k",
        "negative_prompt": "cartoon, blurry, deformed, casual, ugly",
    },
]


async def seed_prompt_presets():
    """Insert default prompt presets if the table is empty."""
    async with async_session() as db:
        result = await db.execute(select(func.count(PromptPreset.id)))
        count = result.scalar() or 0
        if count > 0:
            return

        for preset_data in DEFAULT_PRESETS:
            preset = PromptPreset(
                id=str(uuid.uuid4()),
                name=preset_data["name"],
                category=preset_data["category"],
                prompt_template=preset_data["prompt_template"],
                negative_prompt=preset_data["negative_prompt"],
                created_at=datetime.now(timezone.utc),
            )
            db.add(preset)

        await db.commit()
        logger.info(f"Seeded {len(DEFAULT_PRESETS)} default prompt presets")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    await seed_prompt_presets()
    await polling_service.resume_pending()
    logger.info("FaceLock API started")
    yield
    # Shutdown
    await image_storage.aclose()
    logger.info("FaceLock API shutting down")


app = FastAPI(
    title="FaceLock API",
    description="Consistent AI Character Image Generator",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for serving stored images
storage_path = Path(settings.image_storage_path).resolve()
storage_path.mkdir(parents=True, exist_ok=True)
app.mount("/storage", StaticFiles(directory=str(storage_path)), name="storage")

# Include routes
app.include_router(
    settings_route.router, prefix="/api/settings", tags=["Settings"]
)
app.include_router(
    characters.router, prefix="/api/characters", tags=["Characters"]
)
app.include_router(
    generate.router, prefix="/api/generate", tags=["Generation"]
)
app.include_router(
    training.router, prefix="/api/training", tags=["Training"]
)
app.include_router(
    gallery.router, prefix="/api/gallery", tags=["Gallery"]
)
app.include_router(
    webhooks.router, prefix="/api/webhooks", tags=["Webhooks"]
)

# Presets route
presets_router = APIRouter()


@presets_router.get("", response_model=list[PromptPresetResponse])
async def list_presets(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PromptPreset).order_by(PromptPreset.category)
    )
    presets = result.scalars().all()
    return [
        PromptPresetResponse(
            id=p.id,
            name=p.name,
            category=p.category,
            prompt_template=p.prompt_template,
            negative_prompt=p.negative_prompt,
            default_params=p.default_params,
            created_at=p.created_at,
        )
        for p in presets
    ]


app.include_router(presets_router, prefix="/api/presets", tags=["Presets"])


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "FaceLock API"}
