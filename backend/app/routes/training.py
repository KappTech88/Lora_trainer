from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import Character, get_db
from app.models.schemas import TrainingStatusResponse, TrainingSubmitRequest

router = APIRouter()


def get_training_service():
    from app.main import training_service
    return training_service


@router.post("/submit")
async def submit_training(
    data: TrainingSubmitRequest,
    db: AsyncSession = Depends(get_db),
):
    service = get_training_service()

    # Verify character exists
    result = await db.execute(
        select(Character).where(Character.id == data.character_id)
    )
    character = result.scalar_one_or_none()
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    # Build instance prompt
    instance_prompt = data.instance_prompt
    if not instance_prompt and character.trigger_word:
        instance_prompt = f"photo of {character.trigger_word} person"
    elif not instance_prompt:
        instance_prompt = f"photo of {character.name.lower().replace(' ', '')} person"

    try:
        result = await service.submit_training(
            character_id=data.character_id,
            instance_prompt=instance_prompt,
            class_prompt=data.class_prompt,
            max_train_steps=data.max_train_steps,
            base_model_type=data.base_model_type,
            db=db,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "status": "success",
        "message": "Training job submitted",
        "training_id": result.get("training_id") or result.get("id"),
        "data": result,
    }


@router.get("/{character_id}/status", response_model=TrainingStatusResponse)
async def get_training_status(
    character_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Character).where(Character.id == character_id)
    )
    character = result.scalar_one_or_none()
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    return TrainingStatusResponse(
        training_id=character.lora_training_id,
        status=character.lora_status or "none",
        model_id=character.lora_model_id,
    )


@router.post("/{character_id}/refresh", response_model=TrainingStatusResponse)
async def refresh_training_status(
    character_id: str,
    db: AsyncSession = Depends(get_db),
):
    service = get_training_service()
    result = await service.check_and_update_status(character_id, db)
    return TrainingStatusResponse(**result)
