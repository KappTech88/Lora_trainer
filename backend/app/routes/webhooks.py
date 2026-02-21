import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request

from app.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


def _verify_webhook_token(x_webhook_token: str = Header(default="")) -> None:
    """Verify the webhook request has a valid token if one is configured."""
    expected = settings.webhook_secret
    if expected and x_webhook_token != expected:
        raise HTTPException(status_code=403, detail="Invalid webhook token")


@router.post("/generation")
async def generation_webhook(
    request: Request,
    _: None = Depends(_verify_webhook_token),
):
    """Receive generation completion callbacks from ModelsLab."""
    body = await request.json()
    logger.info(f"Generation webhook received: {body}")
    # The polling service handles updates, so webhooks are a backup
    return {"status": "received"}


@router.post("/training")
async def training_webhook(
    request: Request,
    _: None = Depends(_verify_webhook_token),
):
    """Receive training completion callbacks from ModelsLab."""
    body = await request.json()
    logger.info(f"Training webhook received: {body}")
    return {"status": "received"}
