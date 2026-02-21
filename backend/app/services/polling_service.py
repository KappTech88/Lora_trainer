import asyncio
import logging
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import Generation, async_session
from app.services.image_storage import ImageStorageService
from app.services.modelslab_client import ModelsLabClient

logger = logging.getLogger(__name__)


class PollingService:
    def __init__(
        self, client: ModelsLabClient, storage: ImageStorageService
    ):
        self.client = client
        self.storage = storage
        self.active_polls: dict[str, asyncio.Task] = {}

    async def start_polling(
        self,
        generation_id: str,
        modelslab_id: str,
        endpoint_type: str,
    ) -> None:
        """Launch a background polling task for a generation."""
        if generation_id in self.active_polls:
            return
        task = asyncio.create_task(
            self._poll_loop(generation_id, modelslab_id, endpoint_type)
        )
        self.active_polls[generation_id] = task

    async def _poll_loop(
        self,
        generation_id: str,
        modelslab_id: str,
        endpoint_type: str,
    ) -> None:
        fetch_fn = {
            "images": self.client.fetch_image_result,
            "image_editing": self.client.fetch_editing_result,
        }.get(endpoint_type, self.client.fetch_image_result)

        max_attempts = 60  # ~3 min at 3s intervals

        for attempt in range(max_attempts):
            try:
                result = await fetch_fn(modelslab_id)
                status = result.get("status", "")

                if status == "success":
                    output_urls = result.get("output", [])
                    local_paths = []
                    for i, url in enumerate(output_urls):
                        try:
                            path = await self.storage.download_remote_image(
                                url, generation_id, i
                            )
                            local_paths.append(path)
                        except Exception as e:
                            logger.warning(
                                f"Failed to download image {i} for {generation_id}: {e}"
                            )

                    await self._update_generation(
                        generation_id,
                        "success",
                        output_urls=output_urls,
                        local_paths=local_paths,
                        seed=result.get("meta", {}).get("seed"),
                        generation_time=result.get("generationTime"),
                    )
                    break
                elif status == "error":
                    await self._update_generation(
                        generation_id,
                        "error",
                    )
                    break
            except Exception as e:
                logger.error(
                    f"Polling error for {generation_id} (attempt {attempt}): {e}"
                )
                if attempt == max_attempts - 1:
                    await self._update_generation(generation_id, "error")

            await asyncio.sleep(3)

        self.active_polls.pop(generation_id, None)

    async def _update_generation(
        self,
        generation_id: str,
        status: str,
        output_urls: Optional[list[str]] = None,
        local_paths: Optional[list[str]] = None,
        seed: Optional[int] = None,
        generation_time: Optional[float] = None,
    ) -> None:
        async with async_session() as session:
            result = await session.execute(
                select(Generation).where(Generation.id == generation_id)
            )
            gen = result.scalar_one_or_none()
            if gen:
                gen.status = status
                if output_urls is not None:
                    gen.output_urls = output_urls
                if local_paths is not None:
                    gen.local_paths = local_paths
                if seed is not None:
                    gen.seed = seed
                if generation_time is not None:
                    gen.generation_time = generation_time
                await session.commit()

    async def resume_pending(self) -> None:
        """Resume polling for any generations still in 'processing' state."""
        async with async_session() as session:
            result = await session.execute(
                select(Generation).where(Generation.status == "processing")
            )
            pending = result.scalars().all()
            for gen in pending:
                if gen.modelslab_id and gen.endpoint:
                    endpoint_type = (
                        "image_editing"
                        if "editing" in (gen.endpoint or "")
                        else "images"
                    )
                    await self.start_polling(
                        gen.id, gen.modelslab_id, endpoint_type
                    )
                    logger.info(f"Resumed polling for generation {gen.id}")
