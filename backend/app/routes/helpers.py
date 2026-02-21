from app.models.database import Generation
from app.models.schemas import GenerationResponse


def gen_to_response(gen: Generation) -> GenerationResponse:
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
