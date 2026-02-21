# ModelsLab API Reference — Claude Code Guide

> **Source**: https://docs.modelslab.com/ (scraped Feb 2026)
> **Base URL (Standard)**: `https://modelslab.com/api/v6/`
> **Base URL (Enterprise)**: `https://modelslab.com/api/v1/enterprise/`
> **Auth**: Pass API key in `key` field of JSON request body
> **Content-Type**: `application/json` (all requests are POST)
> **Models directory**: https://modelslab.com/models

---

## Table of Contents

1. [Authentication & Setup](#authentication--setup)
2. [Common Response Format](#common-response-format)
3. [Async Polling Pattern](#async-polling-pattern)
4. [Image Generation API](#image-generation-api)
5. [Image Editing API](#image-editing-api)
6. [Video API](#video-api)
7. [Speech & Audio API](#speech--audio-api)
8. [3D API](#3d-api)
9. [Deepfake API](#deepfake-api)
10. [Uncensored Chat API](#uncensored-chat-api)
11. [Interior API](#interior-api)
12. [Enterprise Extras](#enterprise-extras)
13. [Schedulers](#schedulers)
14. [Error Handling](#error-handling)
15. [SDKs](#sdks)
16. [Webhooks](#webhooks)
17. [Rate Limits & Plans](#rate-limits--plans)

---

## Authentication & Setup

1. Sign up at https://modelslab.com
2. Get API key from https://modelslab.com/dashboard/api-keys
3. Include `"key": "YOUR_API_KEY"` in every request body
4. All endpoints use **POST** method with JSON body
5. Set header: `Content-Type: application/json`
6. Free trial includes 30 API calls

```python
import requests

response = requests.post(
    "https://modelslab.com/api/v6/images/text2img",
    json={
        "key": "YOUR_API_KEY",
        "prompt": "A majestic lion in a savanna at sunset, photorealistic, 8k",
        "model_id": "flux",
        "width": 512,
        "height": 512,
        "samples": 1,
        "num_inference_steps": 30,
        "guidance_scale": 7.5
    }
)
data = response.json()
if data.get("status") == "success":
    print(f"Image URL: {data['output'][0]}")
```

```javascript
const response = await fetch("https://modelslab.com/api/v6/images/text2img", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        key: "YOUR_API_KEY",
        prompt: "A majestic lion in a savanna at sunset, photorealistic, 8k",
        model_id: "flux",
        width: 512,
        height: 512,
        samples: 1,
        num_inference_steps: 30,
        guidance_scale: 7.5
    })
});
const data = await response.json();
```

---

## Common Response Format

### Success Response
```json
{
    "status": "success",
    "generationTime": 2.45,
    "id": "abc123-def456",
    "output": ["https://pub-3626123a908346a7a8be8d9295f44e26.r2.dev/generations/abc123.png"],
    "proxy_links": ["https://cdn2.stablediffusionapi.com/generations/abc123.png"],
    "meta": {
        "prompt": "...",
        "model_id": "flux",
        "width": 512,
        "height": 512,
        "seed": 12345
    }
}
```

### Processing Response (Async)
```json
{
    "status": "processing",
    "id": "abc123-def456",
    "eta": 15,
    "message": "Your request is being processed",
    "fetch_result": "https://modelslab.com/api/v6/images/fetch/abc123-def456",
    "future_links": ["https://pub-...r2.dev/temp/abc123.png"]
}
```

### Error Response
```json
{
    "status": "error",
    "message": "description of what went wrong"
}
```

**Key response fields across all APIs:**
- `status`: `"success"` | `"processing"` | `"error"`
- `generationTime`: seconds taken
- `id`: unique generation ID (use for fetch/polling)
- `output`: array of result URLs
- `proxy_links`: CDN-cached mirrors of output URLs
- `future_links`: pre-generated URLs (available when processing completes)
- `meta`: request metadata echoed back
- `eta`: estimated seconds remaining (when processing)
- `fetch_result`: URL to poll for results
- `nsfw_content_detected`: boolean (if safety_checker enabled)

---

## Async Polling Pattern

When `status` is `"processing"`, poll the fetch endpoint:

```python
import time

# After initial request returns status: "processing"
generation_id = data["id"]

while True:
    fetch_resp = requests.post(
        f"https://modelslab.com/api/v6/images/fetch/{generation_id}",
        json={"key": "YOUR_API_KEY"}
    )
    result = fetch_resp.json()
    if result["status"] == "success":
        print(result["output"])
        break
    time.sleep(3)  # wait before polling again
```

**Fetch endpoints by API type:**
| API | Fetch URL |
|-----|-----------|
| Images (standard) | `POST /api/v6/images/fetch/{id}` |
| Images (realtime) | `POST /api/v6/realtime/fetch/{id}` |
| Video | `POST /api/v6/video/fetch/{id}` |
| Voice/Audio | `POST /api/v6/voice/fetch/{id}` |
| Image Editing | `POST /api/v6/image_editing/fetch/{id}` |
| Enterprise Images | `POST /api/v1/enterprise/images/fetch/{id}` |

Body for all fetch endpoints: `{ "key": "YOUR_API_KEY" }`

---

## Image Generation API

### API Tiers

| Tier | Base URL | Speed | Notes |
|------|----------|-------|-------|
| **Realtime SD** | `/api/v6/realtime/` | 2-3 sec | Fastest, limited params |
| **Flux** | `/api/v6/images/` | 4-5 sec | High-quality Full HD |
| **Community Models** | `/api/v6/images/` | 15-20 sec | 10,000+ models |
| **Enterprise Realtime** | `/api/v1/enterprise/realtime/` | 2-3 sec | Dedicated server |
| **Enterprise SD** | `/api/v1/enterprise/` | Varies | Full control |

---

### Realtime Text to Image

**POST** `https://modelslab.com/api/v6/realtime/text2img`

```json
{
    "key": "",
    "prompt": "ultra realistic portrait of cyberpunk female",
    "negative_prompt": "bad quality",
    "width": 512,
    "height": 512,
    "safety_checker": false,
    "seed": null,
    "samples": 1,
    "base64": false,
    "instant_response": false,
    "enhance_prompt": true,
    "webhook": null,
    "track_id": null
}
```

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `key` | string | ✅ | — | API key |
| `prompt` | string | ✅ | — | Image description |
| `negative_prompt` | string | — | — | What to exclude |
| `width` | int | — | 512 | Max 1024 |
| `height` | int | — | 512 | Max 1024 |
| `samples` | int | — | 1 | Max 4 |
| `safety_checker` | bool | — | true | NSFW filter |
| `seed` | int | — | null (random) | Reproducibility seed |
| `instant_response` | bool | — | false | Queue instantly |
| `base64` | bool | — | false | Return base64 string |
| `enhance_prompt` | bool | — | true | AI prompt enhancement |
| `webhook` | string | — | null | Callback URL |
| `track_id` | int | — | null | Webhook identifier |

---

### Realtime Image to Image

**POST** `https://modelslab.com/api/v6/realtime/img2img`

Additional params beyond text2img:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `init_image` | string | ✅ | — | URL of source image |
| `strength` | float | — | 0.7 | How much to transform (0.0-1.0) |

---

### Realtime Inpainting

**POST** `https://modelslab.com/api/v6/realtime/inpaint`

Additional params:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `init_image` | string | ✅ | URL of source image |
| `mask_image` | string | ✅ | URL of mask (white = replace, black = keep) |

---

### Flux / Community Model Text to Image

**POST** `https://modelslab.com/api/v6/images/text2img`

```json
{
    "key": "",
    "model_id": "flux",
    "prompt": "8K portrait photo, bright eyes, warm smile, detailed face",
    "negative_prompt": "ugly, blurry, bad anatomy, extra limbs",
    "width": 512,
    "height": 512,
    "samples": 1,
    "num_inference_steps": 31,
    "safety_checker": false,
    "safety_checker_type": "sensitive_content_text",
    "enhance_prompt": true,
    "seed": null,
    "guidance_scale": 7.5,
    "use_karras_sigmas": true,
    "algorithm_type": "none",
    "vae": null,
    "lora_strength": null,
    "lora_model": null,
    "clip_skip": 2,
    "base64": false,
    "temp": false,
    "webhook": null,
    "track_id": null,
    "ip_adapter_id": null,
    "ip_adapter_scale": 0.5,
    "ip_adapter_image": null,
    "scheduler": "DDPMScheduler",
    "multi_lingual": false,
    "upscale": false,
    "highres_fix": false
}
```

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `key` | string | ✅ | — | API key |
| `model_id` | string | ✅ | — | Model ID (e.g., `"flux"`, `"sdxl"`, or community model ID) |
| `prompt` | string | ✅ | — | Image description |
| `negative_prompt` | string | — | — | What to exclude |
| `width` | int | — | 512 | Max 1024 |
| `height` | int | — | 512 | Max 1024 |
| `samples` | int | — | 1 | Max 4 |
| `num_inference_steps` | int | — | 31 | Allowed: 21, 31, or 41 |
| `safety_checker` | bool/string | — | false | NSFW filter |
| `safety_checker_type` | string | — | `"sensitive_content_text"` | Action on NSFW detect |
| `enhance_prompt` | bool/string | — | true | AI enhancement |
| `seed` | int | — | null | Reproducibility |
| `guidance_scale` | float | — | 7.5 | Prompt adherence (1-20) |
| `use_karras_sigmas` | bool/string | — | true | Better results |
| `algorithm_type` | string | — | `"none"` | DPMSolver algorithm |
| `vae` | string | — | null | Custom VAE |
| `lora_strength` | string | — | null | LoRA strength 0.1-1, comma-separated for multi |
| `lora_model` | string | — | null | LoRA model ID(s), comma-separated |
| `clip_skip` | int | — | 2 | CLIP skip 1-8 |
| `base64` | bool/string | — | false | Return base64 |
| `temp` | bool/string | — | false | Temp link (24hr) |
| `scheduler` | string | — | — | See [Schedulers](#schedulers) |
| `panorama` | string | — | `"no"` | Generate panorama |
| `self_attention` | string | — | `"no"` | Higher quality (slower) |
| `upscale` | bool/string | — | false | 2× upscale |
| `highres_fix` | bool/string | — | false | High-res fix |
| `multi_lingual` | bool | — | false | Multi-language prompt |
| `ip_adapter_id` | string | — | null | IP Adapter model ID |
| `ip_adapter_scale` | float | — | 0.5 | IP Adapter influence |
| `ip_adapter_image` | string | — | null | Reference image URL |
| `webhook` | string | — | null | Callback URL |
| `track_id` | string | — | null | Webhook tracking |

**Popular model_id values:**
- `flux` — FLUX model, photorealistic, Full HD (4-5 sec)
- `sdxl` — Stable Diffusion XL, artistic/stylized
- Browse https://modelslab.com/models for 10,000+ community models

---

### Flux / Community Image to Image

**POST** `https://modelslab.com/api/v6/images/img2img`

Same as text2img plus:
- `init_image` (string, required): URL of source image
- `strength` (float): Transform amount 0.0-1.0

---

### Flux / Community Inpainting

**POST** `https://modelslab.com/api/v6/images/inpaint`

Same as text2img plus:
- `init_image` (string, required): Source image URL
- `mask_image` (string, required): Mask image URL

---

### ControlNet

**POST** `https://modelslab.com/api/v6/images/controlnet`

Additional params:
- `controlnet_model` (string, required): e.g., `"canny"`, `"depth"`, `"openpose"`, `"scribble"`
- `controlnet_type` (string, required): Same as model name
- `auto_hint` (string): `"yes"` / `"no"` — auto-detect control hints
- `guess_mode` (string): `"yes"` / `"no"`
- `init_image` (string, required): Reference image URL
- `strength` (float): ControlNet influence 0.0-1.0

---

### LoRA Text to Image

**POST** `https://modelslab.com/api/v6/images/text2img`

Use standard text2img with LoRA params:
```json
{
    "lora_model": "contrast-fix",
    "lora_strength": "0.8"
}
```

For **Multi LoRA**, comma-separate:
```json
{
    "lora_model": "more_details,anime_style",
    "lora_strength": "0.8,0.6"
}
```

---

### Model Operations

| Endpoint | URL | Description |
|----------|-----|-------------|
| Fetch Queued | `POST /api/v6/images/fetch/{id}` | Get queued results |
| Reload Model | `POST /api/v6/images/model_reload` | Reload community model |

---

## Image Editing API

**Base URL**: `https://modelslab.com/api/v6/image_editing/`

All endpoints return the standard response format.

### Qwen Edit (NEW)
**POST** `/api/v6/image_editing/qwen_edit`
Edit images using Qwen vision-language model.

### Caption (NEW)
**POST** `/api/v6/image_editing/caption`
Generate captions for images.

### Flux Kontext Image to Image
**POST** `/api/v6/image_editing/flux_kontext_img2img`
Edit image using Flux Kontext model with text prompts.

### Fashion / Virtual Try-On
**POST** `/api/v6/image_editing/fashion`
Overlay clothing on a model body. Requires white background, full-body model photo, and isolated clothing image.

### Face Generator
**POST** `/api/v6/image_editing/face_gen`
```json
{
    "key": "",
    "prompt": "professional headshot",
    "face_image": "https://example.com/face.jpg",
    "negative_prompt": "blurry, cartoon",
    "width": 512,
    "height": 512,
    "num_inference_steps": 25,
    "guidance_scale": 7.5
}
```

### Flux Head Shot
**POST** `/api/v6/image_editing/flux_headshot`
```json
{
    "key": "",
    "prompt": "pretty woman",
    "face_image": "https://example.com/face.jpg",
    "seed": null,
    "width": 1024,
    "height": 1024,
    "num_inference_steps": 25,
    "guidance_scale": 5.5,
    "negative_prompt": "anime, cartoon, ugly, blurry",
    "webhook": null,
    "track_id": null
}
```

### Head Shot
**POST** `/api/v6/image_editing/head_shot`

### Inpainting
**POST** `/api/v6/image_editing/inpaint`
```json
{
    "key": "",
    "prompt": "red roses",
    "init_image": "https://example.com/image.jpg",
    "mask_image": "https://example.com/mask.jpg",
    "width": 512,
    "height": 512,
    "samples": 1,
    "num_inference_steps": 25,
    "guidance_scale": 7.5
}
```

### Outpainting
**POST** `/api/v6/image_editing/outpaint`
```json
{
    "key": "",
    "seed": 12345,
    "width": 512,
    "height": 512,
    "prompt": "lush garden, high quality, realistic",
    "image": "https://example.com/image.jpg",
    "negative_prompt": "low quality, blurry",
    "overlap_width": 32,
    "num_inference_steps": 15,
    "guidance_scale": 8.0,
    "temp": true,
    "base64": false
}
```

### Super Resolution
**POST** `/api/v6/image_editing/super_resolution`
```json
{
    "key": "",
    "init_image": "https://example.com/low-res.jpg",
    "model_id": "realesr-general-x4v3",
    "scale": 3,
    "face_enhance": false,
    "webhook": null,
    "track_id": null
}
```

### Object Removal
**POST** `/api/v6/image_editing/object_removal`
```json
{
    "key": "",
    "init_image": "https://example.com/image.jpg",
    "mask_image": "https://example.com/mask.jpg",
    "webhook": null,
    "track_id": null
}
```

### Background Removal & Mask Creator
**POST** `/api/v6/image_editing/removebg_mask`

### Mask Creator
**POST** `/api/v6/image_editing/mask_creator`

### Image Mixer
**POST** `/api/v6/image_editing/img_mixer`
```json
{
    "key": "",
    "prompt": "merge these styles",
    "init_image": ["https://example.com/img1.jpg", "https://example.com/img2.jpg"],
    "negative_prompt": "",
    "width": 512,
    "height": 512,
    "steps": 25,
    "guidance_scale": 10.5,
    "seed": null,
    "samples": 1
}
```

### Base64 to URL
**POST** `/api/v6/image_editing/base64_to_url`

### Fetch Edited Image
**POST** `/api/v6/image_editing/fetch/{id}`

---

## Video API

**Base URL**: `https://modelslab.com/api/v6/video/`

### Text to Video
**POST** `/api/v6/video/text2video`
```json
{
    "key": "",
    "model_id": "cogvideox",
    "prompt": "A spaceship landing on Mars",
    "negative_prompt": "low quality",
    "height": 512,
    "width": 512,
    "num_frames": 16,
    "num_inference_steps": 20,
    "guidance_scale": 7,
    "upscale_height": 1024,
    "upscale_width": 1024,
    "upscale_strength": 0.6,
    "upscale_guidance_scale": 8,
    "upscale_num_inference_steps": 20,
    "output_type": "gif",
    "webhook": null,
    "track_id": null
}
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `model_id` | string | — | Video model (e.g., `"cogvideox"`) |
| `num_frames` | int | 16 | Number of frames |
| `output_type` | string | `"gif"` | `"gif"` or `"mp4"` |
| `upscale_height` | int | — | Upscaled output height |
| `upscale_width` | int | — | Upscaled output width |
| `upscale_strength` | float | 0.6 | Upscale strength |

### Image to Video
**POST** `/api/v6/video/img2video`

Same as text2video plus:
- `init_image` (string, required): Source image URL

### Video to Video
**POST** `/api/v6/video/video2video`
- `init_video` (string, required): Source video URL
- Output resolution: 1024×576

### Text to Video Ultra
**POST** `/api/v6/video/text2video_ultra`
Higher-definition video generation.

### Image to Video Ultra
**POST** `/api/v6/video/img2video_ultra`
Higher-definition video from images.

### Watermark Remover
**POST** `/api/v6/video/watermark_remover`

### Base64 to URL (Video)
**POST** `/api/v6/video/base64_to_url`

### Fetch Video
**POST** `/api/v6/video/fetch/{id}`

---

## Speech & Audio API

**Base URL**: `https://modelslab.com/api/v6/voice/`

### Text to Speech
**POST** `/api/v6/voice/text_to_speech`
```json
{
    "key": "",
    "prompt": "Hello, welcome to our application.",
    "voice_id": "alloy",
    "language": "english",
    "speed": 1,
    "emotion": false,
    "temp": false,
    "webhook": null,
    "track_id": null
}
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `prompt` | string | — | Text to synthesize |
| `voice_id` | string | — | Voice ID (find at https://modelslab.com/voice-ids) |
| `language` | string | `"english"` | Language |
| `speed` | float | 1 | Playback speed |
| `emotion` | bool | false | Enable emotion tags (English only) |

**Emotion tags** (when `emotion: true`):
Use special tags in prompt text for expressive speech.

### Voice Cloning (Text to Audio)
**POST** `/api/v6/voice/text_to_audio`
```json
{
    "key": "",
    "prompt": "Narrative voices capable of pronouncing terminologies.",
    "init_audio": "https://example.com/voice_sample.wav",
    "voice_id": null,
    "language": "english",
    "emotion": "neutral",
    "webhook": null,
    "track_id": null
}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `init_audio` | string | Audio URL to clone (4-30 seconds) |
| `voice_id` | string | OR use pre-created voice ID |
| `language` | string | Language of output |
| `emotion` | string | Emotional tone |

> **Note**: Pass either `init_audio` OR `voice_id`. If both provided, `init_audio` takes precedence.

### Voice to Voice (Voice Changer)
**POST** `/api/v6/voice/voice_to_voice`
```json
{
    "key": "",
    "init_audio": "https://example.com/source.wav",
    "target_audio": "https://example.com/target_voice.wav",
    "stream": true,
    "base64": false,
    "temp": false,
    "webhook": null,
    "track_id": null
}
```

### Song Cover
**POST** `/api/v6/voice/voice_cover`
```json
{
    "key": "",
    "init_audio": "https://www.youtube.com/watch?v=...",
    "model_id": "zoro",
    "pitch": "none",
    "rate": 0.5,
    "radius": 3,
    "mix": 0.25,
    "algorithm": "rmvpe",
    "hop_length": 128,
    "originality": 0.5,
    "lead_voice_volume_delta": "+1",
    "backup_voice_volume_delta": "-2",
    "instrument_volume_delta": "+2",
    "reverb_size": 0.15,
    "wetness": 0.2,
    "dryness": 0.8,
    "damping": 0.7,
    "base64": false,
    "temp": false
}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `init_audio` | string | YouTube URL or audio URL or base64 WAV |
| `model_id` | string | Voice model ID (e.g., `"zoro"`) |
| `pitch` | string | `"none"`, `"m2f"`, `"f2m"` |
| `algorithm` | string | `"rmvpe"` recommended |
| `originality` | float | 0.0-1.0 |

### Music Generation
**POST** `/api/v6/voice/music_gen`
```json
{
    "key": "",
    "prompt": "epic orchestral battle music",
    "init_audio": null,
    "sampling_rate": 32000,
    "max_new_token": 640,
    "base64": false,
    "temp": false,
    "webhook": null,
    "track_id": null
}
```

### Song Generator (ACE-Step v1.5)
**POST** `/api/v6/voice/song_generator`
Create full songs with vocals in 50+ languages (30 sec to 8 min).

### Speech to Text
**POST** `/api/v6/voice/speech_to_text`

### Vocal Isolator
**POST** `/api/v6/voice/vocal_isolator`
```json
{
    "key": "",
    "init_video": "https://example.com/video.mp4",
    "init_audio": null,
    "base64": false,
    "seed": 0,
    "webhook": null,
    "track_id": null
}
```

### Voice Upload
**POST** `/api/v6/voice/voice_upload`

### Fetch Queued Voice
**POST** `/api/v6/voice/fetch/{id}`

---

## 3D API

**Base URL**: `https://modelslab.com/api/v6/3d/`

### Image to 3D
**POST** `/api/v6/3d/image_to_3d`
```json
{
    "key": "",
    "init_image": "https://example.com/object.png",
    "foreground_ratio": 0.85,
    "remove_bg": false,
    "resolution": 256,
    "chunk_size": 8192,
    "webhook": null,
    "track_id": null
}
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `init_image` | string | — | Source image URL |
| `foreground_ratio` | float | 0.85 | Foreground size ratio |
| `remove_bg` | bool | false | Auto-remove background |
| `resolution` | int | 256 | Output resolution |
| `chunk_size` | int | 8192 | Processing chunk size |

Output: `.obj` file URL

### Text to 3D
**POST** `/api/v6/3d/text_to_3d`

### Fetch 3D
**POST** `/api/v6/3d/fetch/{id}`

---

## Deepfake API

**Base URL**: `https://modelslab.com/api/v6/deepfake/`

### Single Face Swap
**POST** `/api/v6/deepfake/single_face_swap`

### Specific Face Swap
**POST** `/api/v6/deepfake/specific_face_swap`

### Multiple Face Swap
**POST** `/api/v6/deepfake/multiple_face_swap`

### Single Video Swap
**POST** `/api/v6/deepfake/single_video_swap`

### Specific Video Swap
**POST** `/api/v6/deepfake/specific_video_swap`

### Fetch Deepfake
**POST** `/api/v6/deepfake/fetch/{id}`

---

## Uncensored Chat API

Uses OpenAI-compatible format with Bearer token auth.

**POST** `https://modelslab.com/api/v6/llm/chat`

```json
{
    "key": "",
    "model_id": "uncensored-chat",
    "messages": [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hello"}
    ],
    "max_tokens": 100,
    "temperature": 1,
    "top_p": 1,
    "presence_penalty": 0,
    "frequency_penalty": 0,
    "track_id": null,
    "webhook": null
}
```

Supports multi-turn conversation — append `assistant` role messages for context.

---

## Interior API

**POST** `https://modelslab.com/api/v6/interior/make`

```json
{
    "key": "",
    "prompt": "Design a Living Room: Styles: Modern, Scandinavian, Wall Color: #9c27b0ff, Flooring: tile, Furniture: Sofa, Tall lamp",
    "negative_prompt": "blurry, low resolution, bad lighting",
    "init_image": "https://example.com/room.jpg",
    "width": 512,
    "height": 512,
    "samples": 1,
    "guidance_scale": 7.5,
    "num_inference_steps": 25,
    "seed": null,
    "webhook": null,
    "track_id": null
}
```

---

## Enterprise Extras

Enterprise API uses base URL `https://modelslab.com/api/v1/enterprise/` and requires an enterprise API key.

### Enterprise-Only Endpoints

| Category | Endpoint | URL |
|----------|----------|-----|
| **Text to Image** | text2img | `/api/v1/enterprise/text2img` |
| | img2img | `/api/v1/enterprise/img2img` |
| | inpainting | `/api/v1/enterprise/inpaint` |
| | controlnet | `/api/v1/enterprise/controlnet` |
| | super_resolution | `/api/v1/enterprise/super_resolution` |
| **Realtime** | text2img | `/api/v1/enterprise/realtime/text2img` |
| | img2img | `/api/v1/enterprise/realtime/img2img` |
| | inpaint | `/api/v1/enterprise/realtime/inpaint` |
| **Video** | text2video | `/api/v1/enterprise/video/text2video` |
| | img2video | `/api/v1/enterprise/video/img2video` |
| | video2video | `/api/v1/enterprise/video/video2video` |
| **Voice** | text_to_audio | `/api/v1/enterprise/voice/text_to_audio` |
| | voice_cover | `/api/v1/enterprise/voice/voice_cover` |
| **3D** | image_to_3d | `/api/v1/enterprise/3d/image_to_3d` |
| **Deepfake** | face_swap | `/api/v1/enterprise/deepfake/face_swap` |

### Server Management (Enterprise Only)

| Action | URL |
|--------|-----|
| Load Model | `/api/v1/enterprise/load_model` |
| Load Model V2 | `/api/v1/enterprise/load_model_v2` |
| Load VAE | `/api/v1/enterprise/load_vae` |
| Sync Model | `/api/v1/enterprise/sync_model` |
| Delete Model | `/api/v1/enterprise/delete_model` |
| Verify Model | `/api/v1/enterprise/verify_model` |
| Get All Models | `/api/v1/enterprise/get_all_models` |
| List Schedulers | `/api/v1/enterprise/list_schedulers` |
| NSFW Image Check | `/api/v1/enterprise/nsfw_image_check` |
| Upload Image | `/api/v1/enterprise/upload_image` |
| System Details | `/api/v1/enterprise/system_details` |
| Clear Cache | `/api/v1/enterprise/clear_cache` |
| Clear Queue | `/api/v1/enterprise/clear_queue` |
| Restart Server | `/api/v1/enterprise/restart_server` |
| Update Server | `/api/v1/enterprise/update_server` |
| Update S3 Details | `/api/v1/enterprise/update_s3_details` |

### Load Model V2 Example
```json
{
    "key": "enterprise_api_key",
    "url": "https://civitai.com/api/download/models/94640",
    "model_id": "majicmix-realistic",
    "model_category": "stable_diffusion",
    "model_format": "safetensors",
    "revision": "fp16",
    "webhook": null
}
```

Supports: HuggingFace repos, CivitAI links, .ckpt files, ControlNet models.

---

## Schedulers

Supported schedulers for image generation endpoints:

- `DDPMScheduler`
- `DDIMScheduler`
- `PNDMScheduler`
- `LMSDiscreteScheduler`
- `EulerDiscreteScheduler`
- `EulerAncestralDiscreteScheduler`
- `DPMSolverMultistepScheduler`
- `HeunDiscreteScheduler`
- `KDPM2DiscreteScheduler`
- `DPMSolverSinglestepScheduler`
- `KDPM2AncestralDiscreteScheduler`
- `UniPCMultistepScheduler`
- `DDIMInverseScheduler`
- `DEISMultistepScheduler`
- `IPNDMScheduler`
- `KarrasVeScheduler`
- `ScoreSdeVeScheduler`
- `LCMScheduler`

---

## Error Handling

| Status | Meaning | Action |
|--------|---------|--------|
| `"success"` | Generation complete | Use `output` URLs |
| `"processing"` | Still generating | Poll `fetch_result` URL |
| `"error"` | Request failed | Check `message` field |

**Common errors:**
- **Invalid API key**: Verify key, check not revoked
- **Rate limit exceeded**: Wait or upgrade plan
- **Request timeout**: Use async polling pattern
- **Queue limit**: Wait for current requests to complete

**Max resolution**: 1024×1024 pixels
**Max samples per request**: 4
**Temp image links expire**: 24 hours
**Non-S3 enterprise images expire**: 24 hours

---

## Webhooks

Set `"webhook": "https://your-server.com/callback"` in any request to receive a POST callback when generation completes.

The webhook payload matches the standard success response. Use `track_id` to correlate requests with callbacks.

```json
{
    "webhook": "https://your-server.com/api/modelslab-callback",
    "track_id": 12345
}
```

---

## Rate Limits & Plans

| Plan | Features |
|------|----------|
| **Free Trial** | 30 API calls |
| **Basic** | Standard features |
| **Pro** | Higher resolution, ControlNet, Interior API |
| **Enterprise** | Dedicated server, priority support, S3 integration |

- Realtime generation: 2-3 seconds average
- Community models: 15-20 seconds average
- Flux models: 4-5 seconds average
- Exceeding plan limits returns an error; upgrade or purchase additional credits

---

## SDKs

### Python
```bash
pip install modelslab
```
```python
from modelslab import ModelsLab
client = ModelsLab(api_key="YOUR_KEY")
```

### TypeScript / Node.js
```bash
npm install modelslab
```
```typescript
import { ModelsLab, Community, Audio, Video, DeepFake, ImageEditing } from "modelslab";

const client = new ModelsLab({ key: "YOUR_KEY" });
const community = new Community(client.key);
const audio = new Audio(client.key);
const video = new Video(client.key);
const deepfake = new DeepFake(client.key);
const imageEditing = new ImageEditing(client.key);

// Enterprise mode
const enterpriseCommunity = new Community(client.key, true);
```

### PHP
```bash
composer require modelslab/modelslab
```

### Go
```bash
go get github.com/modelslab/modelslab-go
```

### Dart
```bash
dart pub add modelslab
```

---

## Quick Reference: All Standard (v6) Endpoint URLs

### Image Generation
| Endpoint | URL |
|----------|-----|
| Realtime Text2Img | `POST /api/v6/realtime/text2img` |
| Realtime Img2Img | `POST /api/v6/realtime/img2img` |
| Realtime Inpaint | `POST /api/v6/realtime/inpaint` |
| Realtime Fetch | `POST /api/v6/realtime/fetch/{id}` |
| Flux/Community Text2Img | `POST /api/v6/images/text2img` |
| Flux/Community Img2Img | `POST /api/v6/images/img2img` |
| Flux/Community Inpaint | `POST /api/v6/images/inpaint` |
| ControlNet | `POST /api/v6/images/controlnet` |
| LoRA | `POST /api/v6/images/text2img` (with lora params) |
| Fetch Image | `POST /api/v6/images/fetch/{id}` |
| Model Reload | `POST /api/v6/images/model_reload` |

### Image Editing
| Endpoint | URL |
|----------|-----|
| Qwen Edit | `POST /api/v6/image_editing/qwen_edit` |
| Caption | `POST /api/v6/image_editing/caption` |
| Flux Kontext I2I | `POST /api/v6/image_editing/flux_kontext_img2img` |
| Fashion | `POST /api/v6/image_editing/fashion` |
| Face Gen | `POST /api/v6/image_editing/face_gen` |
| Image Mixer | `POST /api/v6/image_editing/img_mixer` |
| Flux Headshot | `POST /api/v6/image_editing/flux_headshot` |
| Mask Creator | `POST /api/v6/image_editing/mask_creator` |
| Object Removal | `POST /api/v6/image_editing/object_removal` |
| Head Shot | `POST /api/v6/image_editing/head_shot` |
| Inpainting | `POST /api/v6/image_editing/inpaint` |
| Outpainting | `POST /api/v6/image_editing/outpaint` |
| Super Resolution | `POST /api/v6/image_editing/super_resolution` |
| Remove BG / Mask | `POST /api/v6/image_editing/removebg_mask` |
| Fetch | `POST /api/v6/image_editing/fetch/{id}` |
| Base64 to URL | `POST /api/v6/image_editing/base64_to_url` |

### Video
| Endpoint | URL |
|----------|-----|
| Text to Video | `POST /api/v6/video/text2video` |
| Image to Video | `POST /api/v6/video/img2video` |
| Video to Video | `POST /api/v6/video/video2video` |
| Text to Video Ultra | `POST /api/v6/video/text2video_ultra` |
| Image to Video Ultra | `POST /api/v6/video/img2video_ultra` |
| Watermark Remover | `POST /api/v6/video/watermark_remover` |
| Fetch Video | `POST /api/v6/video/fetch/{id}` |
| Base64 to URL | `POST /api/v6/video/base64_to_url` |

### Speech & Audio
| Endpoint | URL |
|----------|-----|
| Text to Speech | `POST /api/v6/voice/text_to_speech` |
| Voice Cloning | `POST /api/v6/voice/text_to_audio` |
| Voice to Voice | `POST /api/v6/voice/voice_to_voice` |
| Song Cover | `POST /api/v6/voice/voice_cover` |
| Music Gen | `POST /api/v6/voice/music_gen` |
| Song Generator | `POST /api/v6/voice/song_generator` |
| Speech to Text | `POST /api/v6/voice/speech_to_text` |
| Vocal Isolator | `POST /api/v6/voice/vocal_isolator` |
| Voice Upload | `POST /api/v6/voice/voice_upload` |
| Fetch Voice | `POST /api/v6/voice/fetch/{id}` |

### 3D
| Endpoint | URL |
|----------|-----|
| Image to 3D | `POST /api/v6/3d/image_to_3d` |
| Text to 3D | `POST /api/v6/3d/text_to_3d` |
| Fetch 3D | `POST /api/v6/3d/fetch/{id}` |

### Deepfake
| Endpoint | URL |
|----------|-----|
| Single Face Swap | `POST /api/v6/deepfake/single_face_swap` |
| Specific Face Swap | `POST /api/v6/deepfake/specific_face_swap` |
| Multiple Face Swap | `POST /api/v6/deepfake/multiple_face_swap` |
| Single Video Swap | `POST /api/v6/deepfake/single_video_swap` |
| Specific Video Swap | `POST /api/v6/deepfake/specific_video_swap` |
| Fetch Deepfake | `POST /api/v6/deepfake/fetch/{id}` |

### Other
| Endpoint | URL |
|----------|-----|
| LLM Chat | `POST /api/v6/llm/chat` |
| Interior | `POST /api/v6/interior/make` |

---

## Prompting Tips

- **Be specific**: "A golden retriever puppy playing in autumn leaves, soft natural lighting, shallow depth of field" > "a dog"
- **Style keywords**: `"photorealistic"`, `"8k"`, `"cinematic lighting"`, `"oil painting"`, `"digital art"`
- **Guidance scale**: Lower (3-7) = creative/varied; Higher (8-15) = literal/precise
- **Negative prompts matter**: Always include `"bad quality, blurry, bad anatomy, extra limbs, deformed"` minimum
- **Model selection**: `flux` for photorealistic, `sdxl` for artistic, browse https://modelslab.com/models for specialized models

---

> **Full docs**: https://docs.modelslab.com/
> **API Playground**: https://modelslab.com/playground
> **Models Browser**: https://modelslab.com/models
> **Support**: support@modelslab.com
> **Discord**: https://discord.com/invite/modelslab-1033301189254729748
