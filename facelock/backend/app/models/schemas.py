from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel


# --- Characters ---
class CharacterCreate(BaseModel):
    name: str
    description: Optional[str] = None
    trigger_word: Optional[str] = None
    lora_base_model: Optional[str] = "sdxl"


class CharacterUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    trigger_word: Optional[str] = None


class CharacterImageResponse(BaseModel):
    id: str
    character_id: str
    file_path: Optional[str] = None
    public_url: Optional[str] = None
    image_type: str
    created_at: datetime


class CharacterResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    trigger_word: Optional[str] = None
    lora_model_id: Optional[str] = None
    lora_training_id: Optional[str] = None
    lora_status: str
    lora_base_model: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    image_count: int = 0


# --- Generation ---
class QuickGenerateRequest(BaseModel):
    prompt: str
    negative_prompt: Optional[str] = (
        "cartoon, anime, blurry, ugly, deformed, bad anatomy"
    )
    face_image_id: Optional[str] = None
    face_image_url: Optional[str] = None
    mode: str = "flux_headshot"
    width: int = 1024
    height: int = 1024
    num_inference_steps: int = 25
    guidance_scale: float = 5.5
    seed: Optional[int] = None
    samples: int = 1


class LoraGenerateRequest(BaseModel):
    character_id: str
    prompt: str
    negative_prompt: Optional[str] = (
        "bad anatomy, blurry, ugly, deformed, low quality"
    )
    width: int = 1024
    height: int = 1024
    num_inference_steps: int = 31
    guidance_scale: float = 7.5
    lora_strength: float = 0.7
    scheduler: str = "DPMSolverMultistepScheduler"
    seed: Optional[int] = None
    samples: int = 1
    model_id: Optional[str] = None


class GenerationResponse(BaseModel):
    id: str
    character_id: Optional[str] = None
    modelslab_id: Optional[str] = None
    status: str
    endpoint: Optional[str] = None
    prompt: Optional[str] = None
    negative_prompt: Optional[str] = None
    params: Optional[dict[str, Any]] = None
    output_urls: Optional[list[str]] = None
    local_paths: Optional[list[str]] = None
    generation_time: Optional[float] = None
    seed: Optional[int] = None
    is_favorite: bool = False
    created_at: datetime


# --- Training ---
class TrainingSubmitRequest(BaseModel):
    character_id: str
    instance_prompt: Optional[str] = None
    class_prompt: str = "photo of a person"
    max_train_steps: int = 2000
    base_model_type: str = "sdxl"


class TrainingStatusResponse(BaseModel):
    training_id: Optional[str] = None
    status: str
    model_id: Optional[str] = None
    message: Optional[str] = None


# --- Prompt Presets ---
class PromptPresetResponse(BaseModel):
    id: str
    name: str
    category: Optional[str] = None
    prompt_template: Optional[str] = None
    negative_prompt: Optional[str] = None
    default_params: Optional[dict[str, Any]] = None
    created_at: datetime


# --- Settings ---
class ApiKeyUpdate(BaseModel):
    api_key: str


class SettingsResponse(BaseModel):
    has_api_key: bool
    default_model_id: str
    default_lora_base: str
    default_guidance_scale: float
    default_num_steps: int
    default_width: int
    default_height: int
