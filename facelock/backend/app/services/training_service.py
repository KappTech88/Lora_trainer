import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import Character, CharacterImage
from app.services.image_storage import ImageStorageService
from app.services.modelslab_client import ModelsLabClient

logger = logging.getLogger(__name__)


class TrainingService:
    def __init__(
        self, client: ModelsLabClient, storage: ImageStorageService
    ):
        self.client = client
        self.storage = storage

    async def prepare_training_images(
        self, character_id: str, db: AsyncSession
    ) -> list[str]:
        """Convert local training images to public URLs via base64_to_url."""
        result = await db.execute(
            select(CharacterImage).where(
                CharacterImage.character_id == character_id,
                CharacterImage.image_type == "training",
            )
        )
        images = result.scalars().all()
        public_urls = []

        for img in images:
            if img.public_url:
                public_urls.append(img.public_url)
                continue

            if not img.file_path:
                continue

            try:
                b64_data = self.storage.read_as_base64(img.file_path)
                resp = await self.client.base64_to_url(b64_data)
                if resp.get("status") == "success" and resp.get("output"):
                    url = resp["output"]
                    if isinstance(url, list):
                        url = url[0]
                    img.public_url = url
                    public_urls.append(url)
            except Exception as e:
                logger.error(
                    f"Failed to convert image {img.id} to URL: {e}"
                )

        await db.commit()
        return public_urls

    async def submit_training(
        self,
        character_id: str,
        instance_prompt: str,
        class_prompt: str,
        max_train_steps: int,
        base_model_type: str,
        db: AsyncSession,
    ) -> dict:
        """Submit a LoRA training job."""
        # Get public URLs for training images
        image_urls = await self.prepare_training_images(character_id, db)
        if len(image_urls) < 5:
            raise ValueError(
                f"At least 5 training images required, got {len(image_urls)}. "
                "Upload more images to the character."
            )

        # Submit to ModelsLab
        result = await self.client.submit_lora_training(
            instance_prompt=instance_prompt,
            class_prompt=class_prompt,
            image_urls=image_urls,
            base_model_type=base_model_type,
            max_train_steps=max_train_steps,
        )

        # Update character record
        char_result = await db.execute(
            select(Character).where(Character.id == character_id)
        )
        character = char_result.scalar_one_or_none()
        if character:
            training_id = result.get("training_id") or result.get("id")
            character.lora_training_id = training_id
            character.lora_status = "training"
            character.lora_base_model = base_model_type
            await db.commit()

        return result

    async def check_and_update_status(
        self, character_id: str, db: AsyncSession
    ) -> dict:
        """Check training status and update character accordingly."""
        char_result = await db.execute(
            select(Character).where(Character.id == character_id)
        )
        character = char_result.scalar_one_or_none()
        if not character or not character.lora_training_id:
            return {"status": "none", "message": "No training job found"}

        result = await self.client.check_training_status(
            character.lora_training_id
        )
        status = result.get("status", "unknown")

        # Map ModelsLab statuses
        if status in ("deployed", "ready"):
            character.lora_status = "deployed"
            model_id = result.get("model_id") or result.get("output")
            if model_id:
                if isinstance(model_id, list):
                    model_id = model_id[0]
                character.lora_model_id = model_id
        elif status == "deploying_gpu":
            character.lora_status = "deploying_gpu"
        elif status in ("training", "processing"):
            character.lora_status = "training"
        elif status in ("error", "failed"):
            character.lora_status = "failed"

        await db.commit()

        return {
            "training_id": character.lora_training_id,
            "status": character.lora_status,
            "model_id": character.lora_model_id,
            "message": result.get("message"),
        }
