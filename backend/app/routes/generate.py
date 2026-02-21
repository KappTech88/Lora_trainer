import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import Character, CharacterImage, Generation, get_db
from app.models.schemas import (
    GenerationResponse,
    LoraGenerateRequest,
    QuickGenerateRequest,
)
from app.routes.helpers import gen_to_response

router = APIRouter()


def get_services():
    from app.main import image_storage, modelslab_client, polling_service
    return modelslab_client, polling_service, image_storage


@router.post("/quick", response_model=GenerationResponse)
async def quick_generate(
    data: QuickGenerateRequest,
    db: AsyncSession = Depends(get_db),
):
    client, poller, storage = get_services()

    # Resolve face image URL
    face_url = data.face_image_url
    if not face_url and data.face_image_id:
        result = await db.execute(
            select(CharacterImage).where(
                CharacterImage.id == data.face_image_id
            )
        )
        img = result.scalar_one_or_none()
        if not img:
            raise HTTPException(
                status_code=404, detail="Face image not found"
            )
        if img.public_url:
            face_url = img.public_url
        elif img.file_path:
            b64 = storage.read_as_base64(img.file_path)
            resp = await client.base64_to_url(b64)
            if resp.get("status") == "success":
                url = resp.get("output", "")
                if isinstance(url, list):
                    url = url[0]
                face_url = url
                img.public_url = url
                await db.commit()

    if not face_url:
        raise HTTPException(
            status_code=400,
            detail="No face image provided. Supply face_image_url or face_image_id.",
        )

    # Determine endpoint
    gen_kwargs = {
        "width": data.width,
        "height": data.height,
        "num_inference_steps": data.num_inference_steps,
        "guidance_scale": data.guidance_scale,
        "negative_prompt": data.negative_prompt or "",
        "seed": data.seed,
    }

    if data.mode == "flux_headshot":
        api_result = await client.flux_headshot(
            data.prompt, face_url, **gen_kwargs
        )
        endpoint = "image_editing/flux_headshot"
    else:
        api_result = await client.face_gen(
            data.prompt, face_url, **gen_kwargs
        )
        endpoint = "image_editing/face_gen"

    # Create generation record
    gen_id = str(uuid.uuid4())
    status = api_result.get("status", "error")
    modelslab_id = api_result.get("id")

    gen = Generation(
        id=gen_id,
        modelslab_id=modelslab_id,
        status=status if status in ("success", "processing") else "error",
        endpoint=endpoint,
        prompt=data.prompt,
        negative_prompt=data.negative_prompt,
        params={
            "mode": data.mode,
            "face_image_url": face_url,
            **gen_kwargs,
        },
        created_at=datetime.now(timezone.utc),
    )

    if status == "success":
        gen.output_urls = api_result.get("output", [])
        gen.generation_time = api_result.get("generationTime")
        gen.seed = api_result.get("meta", {}).get("seed")
        # Download images
        local_paths = []
        for i, url in enumerate(gen.output_urls or []):
            try:
                path = await storage.download_remote_image(url, gen_id, i)
                local_paths.append(path)
            except Exception:
                pass
        gen.local_paths = local_paths

    db.add(gen)
    await db.commit()

    # Start polling if processing
    if status == "processing" and modelslab_id:
        await poller.start_polling(gen_id, modelslab_id, "image_editing")

    return gen_to_response(gen)


@router.post("/lora", response_model=GenerationResponse)
async def lora_generate(
    data: LoraGenerateRequest,
    db: AsyncSession = Depends(get_db),
):
    client, poller, storage = get_services()

    # Look up character
    result = await db.execute(
        select(Character).where(Character.id == data.character_id)
    )
    character = result.scalar_one_or_none()
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    if character.lora_status != "deployed" or not character.lora_model_id:
        raise HTTPException(
            status_code=400,
            detail="Character's LoRA model is not deployed. Train the model first.",
        )

    # Auto-inject trigger word
    prompt = data.prompt
    if (
        character.trigger_word
        and character.trigger_word not in prompt
    ):
        prompt = f"photo of {character.trigger_word} person, {prompt}"

    model_id = data.model_id or character.lora_base_model or "sdxl"

    api_result = await client.text2img_lora(
        prompt=prompt,
        model_id=model_id,
        lora_model_id=character.lora_model_id,
        lora_strength=data.lora_strength,
        width=data.width,
        height=data.height,
        samples=data.samples,
        num_inference_steps=data.num_inference_steps,
        guidance_scale=data.guidance_scale,
        scheduler=data.scheduler,
        negative_prompt=data.negative_prompt or "",
        seed=data.seed,
    )

    gen_id = str(uuid.uuid4())
    status = api_result.get("status", "error")
    modelslab_id = api_result.get("id")

    gen = Generation(
        id=gen_id,
        character_id=data.character_id,
        modelslab_id=modelslab_id,
        status=status if status in ("success", "processing") else "error",
        endpoint="images/text2img",
        prompt=prompt,
        negative_prompt=data.negative_prompt,
        params={
            "model_id": model_id,
            "lora_model": character.lora_model_id,
            "lora_strength": data.lora_strength,
            "width": data.width,
            "height": data.height,
            "samples": data.samples,
            "num_inference_steps": data.num_inference_steps,
            "guidance_scale": data.guidance_scale,
            "scheduler": data.scheduler,
            "seed": data.seed,
        },
        created_at=datetime.now(timezone.utc),
    )

    if status == "success":
        gen.output_urls = api_result.get("output", [])
        gen.generation_time = api_result.get("generationTime")
        gen.seed = api_result.get("meta", {}).get("seed")
        local_paths = []
        for i, url in enumerate(gen.output_urls or []):
            try:
                path = await storage.download_remote_image(url, gen_id, i)
                local_paths.append(path)
            except Exception:
                pass
        gen.local_paths = local_paths

    db.add(gen)
    await db.commit()

    if status == "processing" and modelslab_id:
        await poller.start_polling(gen_id, modelslab_id, "images")

    return gen_to_response(gen)


@router.post("/upload-face")
async def upload_face_image(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Upload a face image for Quick Mode and get a public URL."""
    client, _, storage = get_services()

    relative_path, filename = await storage.save_temp_image(file)
    b64 = storage.read_as_base64(relative_path)
    resp = await client.base64_to_url(b64)

    public_url = None
    if resp.get("status") == "success":
        url = resp.get("output", "")
        if isinstance(url, list):
            url = url[0]
        public_url = url

    return {
        "file_path": relative_path,
        "public_url": public_url,
        "filename": filename,
    }


@router.get("/{generation_id}", response_model=GenerationResponse)
async def get_generation(
    generation_id: str, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Generation).where(Generation.id == generation_id)
    )
    gen = result.scalar_one_or_none()
    if not gen:
        raise HTTPException(status_code=404, detail="Generation not found")
    return gen_to_response(gen)
