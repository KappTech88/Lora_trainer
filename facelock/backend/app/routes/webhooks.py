import logging

from fastapi import APIRouter, Request

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/generation")
async def generation_webhook(request: Request):
    """Receive generation completion callbacks from ModelsLab."""
    body = await request.json()
    logger.info(f"Generation webhook received: {body}")
    # The polling service handles updates, so webhooks are a backup
    return {"status": "received"}


@router.post("/training")
async def training_webhook(request: Request):
    """Receive training completion callbacks from ModelsLab."""
    body = await request.json()
    logger.info(f"Training webhook received: {body}")
    return {"status": "received"}
