import logging

import httpx

from app.config import settings

MODELSLAB_BASE = "https://modelslab.com"

logger = logging.getLogger(__name__)


class ModelsLabClient:
    def __init__(self):
        self.api_key = settings.modelslab_api_key
        self.client = httpx.AsyncClient(timeout=60.0)

    def _inject_key(self, payload: dict) -> dict:
        payload["key"] = self.api_key
        return payload

    async def _request(self, method: str, url: str, **kwargs) -> dict:
        """Send a request and return the parsed JSON, raising on HTTP errors."""
        resp = await self.client.request(method, url, **kwargs)
        resp.raise_for_status()
        return resp.json()

    def update_api_key(self, new_key: str) -> None:
        self.api_key = new_key

    # --- Quick Mode ---
    async def flux_headshot(
        self, prompt: str, face_image_url: str, **kwargs
    ) -> dict:
        payload = self._inject_key(
            {
                "prompt": prompt,
                "face_image": face_image_url,
                "width": kwargs.get("width", 1024),
                "height": kwargs.get("height", 1024),
                "num_inference_steps": kwargs.get("num_inference_steps", 25),
                "guidance_scale": kwargs.get("guidance_scale", 5.5),
                "negative_prompt": kwargs.get("negative_prompt", ""),
                "seed": kwargs.get("seed"),
            }
        )
        return await self._request(
            "POST",
            f"{MODELSLAB_BASE}/api/v6/image_editing/flux_headshot",
            json=payload,
        )

    async def face_gen(
        self, prompt: str, face_image_url: str, **kwargs
    ) -> dict:
        payload = self._inject_key(
            {
                "prompt": prompt,
                "face_image": face_image_url,
                "width": kwargs.get("width", 512),
                "height": kwargs.get("height", 512),
                "num_inference_steps": kwargs.get("num_inference_steps", 25),
                "guidance_scale": kwargs.get("guidance_scale", 7.5),
                "negative_prompt": kwargs.get("negative_prompt", ""),
                "seed": kwargs.get("seed"),
            }
        )
        return await self._request(
            "POST",
            f"{MODELSLAB_BASE}/api/v6/image_editing/face_gen",
            json=payload,
        )

    # --- LoRA Generation ---
    async def text2img_lora(
        self,
        prompt: str,
        model_id: str,
        lora_model_id: str,
        lora_strength: float,
        **kwargs,
    ) -> dict:
        payload = self._inject_key(
            {
                "model_id": model_id,
                "prompt": prompt,
                "negative_prompt": kwargs.get("negative_prompt", ""),
                "lora_model": lora_model_id,
                "lora_strength": str(lora_strength),
                "width": kwargs.get("width", 1024),
                "height": kwargs.get("height", 1024),
                "samples": kwargs.get("samples", 1),
                "num_inference_steps": kwargs.get("num_inference_steps", 31),
                "guidance_scale": kwargs.get("guidance_scale", 7.5),
                "scheduler": kwargs.get(
                    "scheduler", "DPMSolverMultistepScheduler"
                ),
                "seed": kwargs.get("seed"),
            }
        )
        return await self._request(
            "POST",
            f"{MODELSLAB_BASE}/api/v6/images/text2img",
            json=payload,
        )

    # --- Standard Text2Img (no LoRA) ---
    async def text2img(self, prompt: str, model_id: str, **kwargs) -> dict:
        payload = self._inject_key(
            {
                "model_id": model_id,
                "prompt": prompt,
                "negative_prompt": kwargs.get("negative_prompt", ""),
                "width": kwargs.get("width", 1024),
                "height": kwargs.get("height", 1024),
                "samples": kwargs.get("samples", 1),
                "num_inference_steps": kwargs.get("num_inference_steps", 31),
                "guidance_scale": kwargs.get("guidance_scale", 7.5),
                "scheduler": kwargs.get(
                    "scheduler", "DPMSolverMultistepScheduler"
                ),
                "seed": kwargs.get("seed"),
            }
        )
        return await self._request(
            "POST",
            f"{MODELSLAB_BASE}/api/v6/images/text2img",
            json=payload,
        )

    # --- Training ---
    async def submit_lora_training(
        self,
        instance_prompt: str,
        class_prompt: str,
        image_urls: list[str],
        **kwargs,
    ) -> dict:
        payload = self._inject_key(
            {
                "instance_prompt": instance_prompt,
                "class_prompt": class_prompt,
                "base_model_type": kwargs.get("base_model_type", "sdxl"),
                "negative_prompt": kwargs.get(
                    "negative_prompt",
                    "lowres, bad anatomy, bad hands, text, error",
                ),
                "images": image_urls,
                "training_type": "lora",
                "max_train_steps": str(kwargs.get("max_train_steps", 2000)),
                "webhook": kwargs.get("webhook"),
            }
        )
        return await self._request(
            "POST",
            f"{MODELSLAB_BASE}/api/v3/lora_fine_tune",
            json=payload,
        )

    async def check_training_status(self, training_id: str) -> dict:
        payload = self._inject_key({})
        return await self._request(
            "POST",
            f"{MODELSLAB_BASE}/api/v3/fine_tune_status/{training_id}",
            json=payload,
        )

    # --- Polling / Fetch ---
    async def fetch_image_result(self, generation_id: str) -> dict:
        payload = self._inject_key({})
        return await self._request(
            "POST",
            f"{MODELSLAB_BASE}/api/v6/images/fetch/{generation_id}",
            json=payload,
        )

    async def fetch_editing_result(self, generation_id: str) -> dict:
        payload = self._inject_key({})
        return await self._request(
            "POST",
            f"{MODELSLAB_BASE}/api/v6/image_editing/fetch/{generation_id}",
            json=payload,
        )

    # --- Image Editing ---
    async def super_resolution(self, image_url: str, **kwargs) -> dict:
        payload = self._inject_key(
            {
                "init_image": image_url,
                "model_id": kwargs.get("model_id", "realesr-general-x4v3"),
                "scale": kwargs.get("scale", 3),
                "face_enhance": kwargs.get("face_enhance", False),
            }
        )
        return await self._request(
            "POST",
            f"{MODELSLAB_BASE}/api/v6/image_editing/super_resolution",
            json=payload,
        )

    async def remove_background(self, image_url: str) -> dict:
        payload = self._inject_key({"init_image": image_url})
        return await self._request(
            "POST",
            f"{MODELSLAB_BASE}/api/v6/image_editing/removebg_mask",
            json=payload,
        )

    # --- Utility ---
    async def base64_to_url(self, base64_data: str) -> dict:
        payload = self._inject_key({"image": base64_data})
        return await self._request(
            "POST",
            f"{MODELSLAB_BASE}/api/v6/image_editing/base64_to_url",
            json=payload,
        )
