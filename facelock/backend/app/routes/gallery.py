from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import Generation, get_db
from app.models.schemas import GenerationResponse

router = APIRouter()


def get_storage():
    from app.main import image_storage
    return image_storage


def _gen_to_response(gen: Generation) -> GenerationResponse:
    return GenerationResponse(
        id=gen.id,
        character_id=gen.character_id,
        modelslab_id=gen.modelslab_id,
        status=gen.status,
        endpoint=gen.endpoint,
        prompt=gen.prompt,
        negative_prompt=gen.negative_prompt,
        params=gen.params,
        output_urls=gen.output_urls,
        local_paths=gen.local_paths,
        generation_time=gen.generation_time,
        seed=gen.seed,
        is_favorite=gen.is_favorite or False,
        created_at=gen.created_at,
    )


@router.get("", response_model=list[GenerationResponse])
async def list_generations(
    character_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    is_favorite: Optional[bool] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    query = select(Generation).order_by(Generation.created_at.desc())

    if character_id:
        query = query.where(Generation.character_id == character_id)
    if status:
        query = query.where(Generation.status == status)
    if is_favorite is not None:
        query = query.where(Generation.is_favorite == is_favorite)

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    generations = result.scalars().all()

    return [_gen_to_response(gen) for gen in generations]


@router.put("/{generation_id}/favorite")
async def toggle_favorite(
    generation_id: str, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Generation).where(Generation.id == generation_id)
    )
    gen = result.scalar_one_or_none()
    if not gen:
        raise HTTPException(status_code=404, detail="Generation not found")

    gen.is_favorite = not (gen.is_favorite or False)
    await db.commit()

    return {
        "status": "success",
        "is_favorite": gen.is_favorite,
    }


@router.delete("/{generation_id}")
async def delete_generation(
    generation_id: str, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Generation).where(Generation.id == generation_id)
    )
    gen = result.scalar_one_or_none()
    if not gen:
        raise HTTPException(status_code=404, detail="Generation not found")

    # Delete local files
    storage = get_storage()
    storage.delete_directory(f"generations/{generation_id}")

    await db.delete(gen)
    await db.commit()
    return {"status": "success", "message": "Generation deleted"}
