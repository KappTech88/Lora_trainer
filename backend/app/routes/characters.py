import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import Character, CharacterImage, get_db
from app.models.schemas import (
    CharacterCreate,
    CharacterImageResponse,
    CharacterResponse,
    CharacterUpdate,
)

router = APIRouter()


def get_storage():
    from app.main import image_storage
    return image_storage


@router.get("", response_model=list[CharacterResponse])
async def list_characters(db: AsyncSession = Depends(get_db)):
    # Single query with image count subquery to avoid N+1
    count_subq = (
        select(
            CharacterImage.character_id,
            func.count(CharacterImage.id).label("cnt"),
        )
        .group_by(CharacterImage.character_id)
        .subquery()
    )
    query = (
        select(Character, count_subq.c.cnt)
        .outerjoin(count_subq, Character.id == count_subq.c.character_id)
        .order_by(Character.created_at.desc())
    )
    result = await db.execute(query)
    rows = result.all()

    return [
        CharacterResponse(
            id=char.id,
            name=char.name,
            description=char.description,
            trigger_word=char.trigger_word,
            lora_model_id=char.lora_model_id,
            lora_training_id=char.lora_training_id,
            lora_status=char.lora_status or "none",
            lora_base_model=char.lora_base_model,
            created_at=char.created_at,
            updated_at=char.updated_at,
            image_count=cnt or 0,
        )
        for char, cnt in rows
    ]


@router.post("", response_model=CharacterResponse, status_code=201)
async def create_character(
    data: CharacterCreate, db: AsyncSession = Depends(get_db)
):
    now = datetime.now(timezone.utc)
    character = Character(
        id=str(uuid.uuid4()),
        name=data.name,
        description=data.description,
        trigger_word=data.trigger_word,
        lora_base_model=data.lora_base_model,
        lora_status="none",
        created_at=now,
        updated_at=now,
    )
    db.add(character)
    await db.commit()
    await db.refresh(character)

    return CharacterResponse(
        id=character.id,
        name=character.name,
        description=character.description,
        trigger_word=character.trigger_word,
        lora_model_id=character.lora_model_id,
        lora_training_id=character.lora_training_id,
        lora_status=character.lora_status or "none",
        lora_base_model=character.lora_base_model,
        created_at=character.created_at,
        updated_at=character.updated_at,
        image_count=0,
    )


@router.get("/{character_id}", response_model=CharacterResponse)
async def get_character(
    character_id: str, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Character).where(Character.id == character_id)
    )
    character = result.scalar_one_or_none()
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    img_count = await db.execute(
        select(func.count(CharacterImage.id)).where(
            CharacterImage.character_id == character_id
        )
    )
    count = img_count.scalar() or 0

    return CharacterResponse(
        id=character.id,
        name=character.name,
        description=character.description,
        trigger_word=character.trigger_word,
        lora_model_id=character.lora_model_id,
        lora_training_id=character.lora_training_id,
        lora_status=character.lora_status or "none",
        lora_base_model=character.lora_base_model,
        created_at=character.created_at,
        updated_at=character.updated_at,
        image_count=count,
    )


@router.put("/{character_id}", response_model=CharacterResponse)
async def update_character(
    character_id: str,
    data: CharacterUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Character).where(Character.id == character_id)
    )
    character = result.scalar_one_or_none()
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    if data.name is not None:
        character.name = data.name
    if data.description is not None:
        character.description = data.description
    if data.trigger_word is not None:
        character.trigger_word = data.trigger_word
    character.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(character)

    img_count = await db.execute(
        select(func.count(CharacterImage.id)).where(
            CharacterImage.character_id == character_id
        )
    )
    count = img_count.scalar() or 0

    return CharacterResponse(
        id=character.id,
        name=character.name,
        description=character.description,
        trigger_word=character.trigger_word,
        lora_model_id=character.lora_model_id,
        lora_training_id=character.lora_training_id,
        lora_status=character.lora_status or "none",
        lora_base_model=character.lora_base_model,
        created_at=character.created_at,
        updated_at=character.updated_at,
        image_count=count,
    )


@router.delete("/{character_id}")
async def delete_character(
    character_id: str, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Character).where(Character.id == character_id)
    )
    character = result.scalar_one_or_none()
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    storage = get_storage()
    storage.delete_directory(f"characters/{character_id}")

    await db.delete(character)
    await db.commit()
    return {"status": "success", "message": "Character deleted"}


@router.post(
    "/{character_id}/images", response_model=list[CharacterImageResponse]
)
async def upload_images(
    character_id: str,
    files: list[UploadFile] = File(...),
    image_type: str = Form("training"),
    db: AsyncSession = Depends(get_db),
):
    # Validate image_type
    if image_type not in ("training", "reference"):
        raise HTTPException(status_code=400, detail="Invalid image_type. Must be 'training' or 'reference'.")

    # Verify character exists
    result = await db.execute(
        select(Character).where(Character.id == character_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Character not found")

    storage = get_storage()
    created_images = []

    for file in files:
        relative_path, filename = await storage.save_uploaded_image(
            file, character_id, image_type
        )
        img = CharacterImage(
            id=str(uuid.uuid4()),
            character_id=character_id,
            file_path=relative_path,
            image_type=image_type,
            created_at=datetime.now(timezone.utc),
        )
        db.add(img)
        created_images.append(img)

    await db.commit()

    return [
        CharacterImageResponse(
            id=img.id,
            character_id=img.character_id,
            file_path=img.file_path,
            public_url=img.public_url,
            image_type=img.image_type,
            created_at=img.created_at,
        )
        for img in created_images
    ]


@router.get(
    "/{character_id}/images", response_model=list[CharacterImageResponse]
)
async def get_character_images(
    character_id: str, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(CharacterImage)
        .where(CharacterImage.character_id == character_id)
        .order_by(CharacterImage.created_at.desc())
    )
    images = result.scalars().all()
    return [
        CharacterImageResponse(
            id=img.id,
            character_id=img.character_id,
            file_path=img.file_path,
            public_url=img.public_url,
            image_type=img.image_type,
            created_at=img.created_at,
        )
        for img in images
    ]


@router.delete("/{character_id}/images/{image_id}")
async def delete_image(
    character_id: str,
    image_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CharacterImage).where(
            CharacterImage.id == image_id,
            CharacterImage.character_id == character_id,
        )
    )
    img = result.scalar_one_or_none()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")

    if img.file_path:
        storage = get_storage()
        storage.delete_image(img.file_path)

    await db.delete(img)
    await db.commit()
    return {"status": "success", "message": "Image deleted"}
