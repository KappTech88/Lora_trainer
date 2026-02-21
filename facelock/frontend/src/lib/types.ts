export interface Character {
  id: string;
  name: string;
  description?: string;
  trigger_word?: string;
  lora_model_id?: string;
  lora_training_id?: string;
  lora_status: "none" | "training" | "deploying_gpu" | "deployed" | "failed";
  lora_base_model?: string;
  created_at: string;
  updated_at: string;
  image_count: number;
}

export interface CharacterImage {
  id: string;
  character_id: string;
  file_path?: string;
  public_url?: string;
  image_type: "training" | "reference";
  created_at: string;
}

export interface Generation {
  id: string;
  character_id?: string;
  modelslab_id?: string;
  status: "success" | "processing" | "error";
  endpoint?: string;
  prompt?: string;
  negative_prompt?: string;
  params?: Record<string, unknown>;
  output_urls?: string[];
  local_paths?: string[];
  generation_time?: number;
  seed?: number;
  is_favorite: boolean;
  created_at: string;
}

export interface PromptPreset {
  id: string;
  name: string;
  category?: string;
  prompt_template?: string;
  negative_prompt?: string;
  default_params?: Record<string, unknown>;
  created_at: string;
}

export interface QuickGenerateRequest {
  prompt: string;
  negative_prompt?: string;
  face_image_id?: string;
  face_image_url?: string;
  mode: "flux_headshot" | "face_gen";
  width?: number;
  height?: number;
  num_inference_steps?: number;
  guidance_scale?: number;
  seed?: number;
  samples?: number;
}

export interface LoraGenerateRequest {
  character_id: string;
  prompt: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  num_inference_steps?: number;
  guidance_scale?: number;
  lora_strength?: number;
  scheduler?: string;
  seed?: number;
  samples?: number;
  model_id?: string;
}

export interface CharacterCreate {
  name: string;
  description?: string;
  trigger_word?: string;
  lora_base_model?: string;
}

export interface TrainingSubmitRequest {
  character_id: string;
  instance_prompt?: string;
  class_prompt?: string;
  max_train_steps?: number;
  base_model_type?: string;
}

export interface TrainingStatus {
  training_id?: string;
  status: string;
  model_id?: string;
  message?: string;
}

export interface Settings {
  has_api_key: boolean;
  default_model_id: string;
  default_lora_base: string;
  default_guidance_scale: number;
  default_num_steps: number;
  default_width: number;
  default_height: number;
}

export interface UploadedFace {
  file_path: string;
  public_url?: string;
  filename: string;
}
