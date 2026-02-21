# PRD: FaceLock — Consistent AI Character Image Generator

## Private-Use App for Generating Consistent Character/Self Images via ModelsLab API

---

## 1. Problem Statement

Generating AI images of a specific person or character that look **consistently like the same individual** across multiple generations is not possible with vanilla text-to-image prompts. Each generation produces a different face. This app solves that by combining LoRA fine-tuning (for true identity lock) with reference-image-based generation (for quick variants), all orchestrated through ModelsLab's API.

---

## 2. Target User

Bryant (private use). Single-user local web app. No multi-tenant auth needed.

---

## 3. Core Capabilities

### Tier 1: Quick Mode (No Training — Instant Results)
Use ModelsLab's **Face Generator**, **Flux Headshot**, and **IP Adapter** endpoints to generate variants from a reference face image. Good for "give me 4 quick headshots of myself" use cases.

**Tradeoff**: Consistency degrades across many generations and complex poses. The face will look *similar* but not *identical*.

### Tier 2: LoRA Mode (Training Required — Identity Lock)
Train a custom **LoRA model** on 10-20 images of a face/character using ModelsLab's fine-tuning API ($1 per training run). Then generate unlimited images using that LoRA — the face stays locked to that specific identity regardless of pose, clothing, setting, or style.

**Tradeoff**: Requires upfront training time (~15-30 min) and curated training images. But this is how consistent characters are actually done.

### Tier 3: Editing Mode
Post-process generated images with upscaling, background removal, outpainting, and inpainting using ModelsLab's Image Editing API.

---

## 4. Feature Requirements

### 4.1 Character/Identity Management

| Feature | Priority | Description |
|---------|----------|-------------|
| Create Character Profile | P0 | Name, description, reference images (10-20), trigger word |
| Upload Training Images | P0 | Upload 10-20 face images (varied angles, lighting, expressions) |
| Train LoRA Model | P0 | Submit training job via `/api/v3/lora_fine_tune`, poll status, store resulting model_id |
| Training Status Dashboard | P0 | Show training progress, status (training/deploying_gpu/deployed/failed) |
| List Trained Models | P1 | Fetch via `/api/v3/finetune_list` |
| Delete Model | P2 | Via training delete endpoint |
| Quick Reference Mode | P1 | Skip training, use face image directly with IP Adapter / Face Gen |

### 4.2 Image Generation

| Feature | Priority | Description |
|---------|----------|-------------|
| Text-to-Image with LoRA | P0 | Generate images using trained model via `/api/v6/images/text2img` with `lora_model` param |
| Prompt Builder | P0 | UI with prompt field, negative prompt, style presets, and LoRA strength slider |
| Batch Generation | P0 | Generate 1-4 images per request (`samples` param) |
| Quick Headshot | P1 | One-click headshot via `/api/v6/image_editing/flux_headshot` with uploaded face |
| Face Generator | P1 | Generate face variants via `/api/v6/image_editing/face_gen` |
| IP Adapter Reference | P1 | Use `ip_adapter_image` + `ip_adapter_id` on text2img for reference-guided generation |
| ControlNet Pose Control | P2 | Upload pose reference, generate character in that pose via `/api/v5/controlnet` |
| Img2Img Variations | P2 | Take a generated image, create variations via `/api/v6/images/img2img` |
| Inpainting | P2 | Edit specific regions of generated images |
| Style Presets | P1 | Pre-built prompt templates: "professional headshot", "fantasy portrait", "anime style", "action pose", etc. |

### 4.3 Image Editing & Post-Processing

| Feature | Priority | Description |
|---------|----------|-------------|
| Super Resolution | P1 | Upscale via `/api/v6/image_editing/super_resolution` |
| Background Removal | P1 | Via `/api/v6/image_editing/removebg_mask` |
| Outpainting | P2 | Expand image canvas via `/api/v6/image_editing/outpaint` |
| Object Removal | P2 | Clean up unwanted elements |

### 4.4 Gallery & History

| Feature | Priority | Description |
|---------|----------|-------------|
| Generation History | P0 | Store all generations with prompt, params, output URLs, and metadata |
| Image Gallery | P0 | Grid view of all generated images, filterable by character |
| Favorites | P1 | Star/bookmark best generations |
| Download | P0 | Download individual or batch images |
| Regenerate | P1 | Re-run a previous generation with same params or tweaked seed |
| Prompt History | P1 | Reuse and modify past prompts |

### 4.5 Settings & Config

| Feature | Priority | Description |
|---------|----------|-------------|
| API Key Management | P0 | Store/update ModelsLab API key |
| Default Parameters | P1 | Set defaults for guidance_scale, steps, dimensions, scheduler, etc. |
| Webhook Receiver | P2 | Local webhook endpoint to receive async generation callbacks |

---

## 5. Technical Architecture

### 5.1 Stack

```
┌─────────────────────────────────────────┐
│           Frontend (React/Next.js)       │
│  - Character management UI               │
│  - Prompt builder                         │
│  - Gallery/history viewer                 │
│  - Training status dashboard              │
└──────────────┬──────────────────────────┘
               │ REST API
┌──────────────▼──────────────────────────┐
│           Backend (FastAPI or Next API)   │
│  - ModelsLab API orchestration            │
│  - Async polling manager                  │
│  - Image/training job queue               │
│  - File storage management                │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│           Database (SQLite)               │
│  - Characters + training images           │
│  - LoRA model references                  │
│  - Generation history + params            │
│  - Prompt library                         │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│           ModelsLab API                   │
│  - /api/v3/lora_fine_tune (train)         │
│  - /api/v6/images/text2img (generate)     │
│  - /api/v6/image_editing/* (edit)         │
│  - /api/v6/images/fetch/{id} (poll)       │
└─────────────────────────────────────────┘
```

### 5.2 Key Technical Decisions

- **SQLite** for local storage — no need for Postgres for private use
- **Local file storage** for downloaded images (organized by character)
- **Async polling service** — background job that polls ModelsLab fetch endpoints for processing generations
- **No auth layer** — private local app, API key stored in env/config
- **Image hosting for training**: Training images must be publicly accessible URLs. App needs to either upload to ModelsLab's base64 endpoint or use a simple file server / temp hosting

### 5.3 Database Schema

```sql
-- Characters / Identities
CREATE TABLE characters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    trigger_word TEXT,           -- e.g., "bryantface" for LoRA
    lora_model_id TEXT,          -- ModelsLab model ID after training
    lora_training_id TEXT,       -- Training job ID
    lora_status TEXT,            -- training/deployed/failed/none
    lora_base_model TEXT,        -- sdxl, sd15, flux
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- Training/reference images for a character
CREATE TABLE character_images (
    id TEXT PRIMARY KEY,
    character_id TEXT REFERENCES characters(id),
    file_path TEXT,              -- local path
    public_url TEXT,             -- URL accessible by ModelsLab
    image_type TEXT,             -- training / reference
    created_at TIMESTAMP
);

-- Generation history
CREATE TABLE generations (
    id TEXT PRIMARY KEY,
    character_id TEXT REFERENCES characters(id),
    modelslab_id TEXT,           -- ID from ModelsLab response
    status TEXT,                 -- success/processing/error
    endpoint TEXT,               -- which API endpoint used
    prompt TEXT,
    negative_prompt TEXT,
    params JSON,                 -- full request params
    output_urls JSON,            -- array of result URLs
    local_paths JSON,            -- downloaded local paths
    generation_time FLOAT,
    seed INTEGER,
    is_favorite BOOLEAN DEFAULT 0,
    created_at TIMESTAMP
);

-- Reusable prompt templates
CREATE TABLE prompt_presets (
    id TEXT PRIMARY KEY,
    name TEXT,
    category TEXT,               -- headshot/portrait/action/fantasy/etc
    prompt_template TEXT,         -- with {trigger_word} placeholder
    negative_prompt TEXT,
    default_params JSON,
    created_at TIMESTAMP
);
```

---

## 6. API Integration Details

### 6.1 LoRA Training Flow

```
User uploads 10-20 images
    ↓
App uploads images to get public URLs (base64_to_url endpoint or local server)
    ↓
POST /api/v3/lora_fine_tune
{
    "key": "API_KEY",
    "instance_prompt": "photo of {trigger_word} person",
    "class_prompt": "photo of a person",
    "base_model_type": "sdxl",
    "negative_prompt": "lowres, bad anatomy, bad hands, text, error...",
    "images": ["url1", "url2", ... "url10-20"],
    "training_type": "lora",
    "max_train_steps": "2000",
    "webhook": "http://localhost:PORT/webhook/training"
}
    ↓
Returns: { "training_id": "abc123" }
    ↓
Poll: POST /api/v3/fine_tune_status/{training_id}
    ↓
Status transitions: training → deploying_gpu → deployed → ready
    ↓
Store resulting model_id for generation use
```

**Training cost**: $1 per LoRA training run (charged to ModelsLab wallet)

**Training image requirements**:
- 10-20 images minimum
- Varied angles, lighting, expressions
- Clear face visibility
- Mix of close-up and medium shots
- Consistent subject (same person/character)

### 6.2 Generation with Trained LoRA

```
POST /api/v6/images/text2img
{
    "key": "API_KEY",
    "model_id": "sdxl",                      // or whichever base was used
    "prompt": "photo of bryantface man in a business suit, office background, professional lighting, 8k",
    "negative_prompt": "bad anatomy, blurry, ugly, deformed...",
    "lora_model": "YOUR_TRAINED_LORA_ID",
    "lora_strength": "0.7",                  // 0.5-0.8 sweet spot
    "width": 1024,
    "height": 1024,
    "samples": 4,
    "num_inference_steps": 31,
    "guidance_scale": 7.5,
    "scheduler": "DPMSolverMultistepScheduler",
    "seed": null
}
```

**Critical**: The `instance_prompt` trigger word (e.g., "bryantface") MUST appear in the generation prompt. This is what tells the model "use that specific face."

### 6.3 Quick Mode (No Training)

**Option A — Flux Headshot:**
```
POST /api/v6/image_editing/flux_headshot
{
    "key": "API_KEY",
    "prompt": "professional headshot, business attire, studio lighting",
    "face_image": "https://url-to-your-face.jpg",
    "width": 1024,
    "height": 1024,
    "num_inference_steps": 25,
    "guidance_scale": 5.5,
    "negative_prompt": "anime, cartoon, blurry, ugly"
}
```

**Option B — IP Adapter (reference-guided text2img):**
```
POST /api/v6/images/text2img
{
    "key": "API_KEY",
    "model_id": "sdxl",
    "prompt": "portrait of a man in medieval armor, cinematic",
    "ip_adapter_id": "ip-adapter_sdxl",
    "ip_adapter_scale": 0.6,
    "ip_adapter_image": "https://url-to-your-face.jpg",
    ...standard params
}
```

**Option C — Face Generator:**
```
POST /api/v6/image_editing/face_gen
{
    "key": "API_KEY",
    "prompt": "man in a leather jacket, city background",
    "face_image": "https://url-to-your-face.jpg",
    "width": 512,
    "height": 512,
    "num_inference_steps": 25,
    "guidance_scale": 7.5
}
```

### 6.4 Async Polling Manager

All ModelsLab endpoints can return `"status": "processing"`. The app needs a background polling service:

```python
async def poll_generation(generation_id: str, endpoint_type: str):
    """Poll ModelsLab fetch endpoint until complete."""
    fetch_urls = {
        "images": f"https://modelslab.com/api/v6/images/fetch/{generation_id}",
        "realtime": f"https://modelslab.com/api/v6/realtime/fetch/{generation_id}",
        "image_editing": f"https://modelslab.com/api/v6/image_editing/fetch/{generation_id}",
        "training": f"https://modelslab.com/api/v3/fine_tune_status/{generation_id}",
    }
    
    url = fetch_urls[endpoint_type]
    max_attempts = 60  # 3 min at 3s intervals
    
    for attempt in range(max_attempts):
        resp = requests.post(url, json={"key": API_KEY})
        data = resp.json()
        
        if data["status"] == "success":
            return data
        elif data["status"] == "error":
            raise Exception(data.get("message", "Generation failed"))
        
        await asyncio.sleep(3)
    
    raise TimeoutError("Generation timed out")
```

---

## 7. UI Layout

### 7.1 Pages

```
/                          → Dashboard (recent generations, active trainings)
/characters                → Character list + create new
/characters/:id            → Character detail (reference images, LoRA status, generations)
/characters/:id/train      → Training wizard (upload images, configure, submit)
/generate                  → Main generation interface
/generate/quick            → Quick mode (no LoRA, just face reference)
/gallery                   → All generations, filterable
/settings                  → API key, defaults, storage config
```

### 7.2 Generation Interface Wireframe

```
┌─────────────────────────────────────────────────────┐
│  [Character Selector ▼]  [Quick Mode] [LoRA Mode]   │
├─────────────────────────────────────────────────────┤
│                                                       │
│  Prompt:  [________________________________________________] │
│  Negative: [________________________________________________] │
│                                                       │
│  ┌─── Style Presets ──┐  ┌─── Parameters ──────────┐ │
│  │ ○ Headshot         │  │ Size: [1024] x [1024]    │ │
│  │ ○ Portrait         │  │ Steps: [31 ━━━━━━━]      │ │
│  │ ○ Full Body        │  │ Guidance: [7.5 ━━━━━]    │ │
│  │ ○ Fantasy          │  │ LoRA Str: [0.7 ━━━━━]    │ │
│  │ ○ Anime            │  │ Samples: [4]             │ │
│  │ ○ Custom           │  │ Scheduler: [DPMSolver ▼] │ │
│  └────────────────────┘  │ Seed: [random]           │ │
│                           └─────────────────────────┘ │
│                                                       │
│  [🎲 Generate]  [♻️ Regenerate Last]                  │
│                                                       │
├─────────────────────────────────────────────────────┤
│  Results:                                             │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐                        │
│  │    │ │    │ │    │ │    │  ← Click to expand      │
│  │ 1  │ │ 2  │ │ 3  │ │ 4  │                        │
│  └────┘ └────┘ └────┘ └────┘                        │
│  [⬇️ Download All] [⭐ Favorite] [✏️ Edit] [🔄 Vary] │
└─────────────────────────────────────────────────────┘
```

---

## 8. Seed Data: Default Prompt Presets

```json
[
    {
        "name": "Professional Headshot",
        "category": "headshot",
        "prompt_template": "professional headshot photo of {trigger_word} person, studio lighting, neutral background, business attire, sharp focus, 8k, photorealistic",
        "negative_prompt": "cartoon, anime, blurry, bad anatomy, deformed, ugly, low quality, extra limbs"
    },
    {
        "name": "Fantasy Portrait",
        "category": "fantasy",
        "prompt_template": "epic fantasy portrait of {trigger_word} person as a warrior, ornate armor, dramatic lighting, magical aura, cinematic, 8k, detailed",
        "negative_prompt": "modern clothing, blurry, bad anatomy, deformed, low quality"
    },
    {
        "name": "Casual Lifestyle",
        "category": "lifestyle",
        "prompt_template": "candid photo of {trigger_word} person in casual clothing, natural outdoor setting, golden hour lighting, lifestyle photography, 8k",
        "negative_prompt": "studio, artificial, blurry, deformed, ugly"
    },
    {
        "name": "Anime Style",
        "category": "anime",
        "prompt_template": "anime illustration of {trigger_word} person, vibrant colors, detailed eyes, clean linework, studio ghibli style, beautiful",
        "negative_prompt": "photorealistic, blurry, bad anatomy, western cartoon, low quality"
    },
    {
        "name": "Action Hero",
        "category": "action",
        "prompt_template": "cinematic action shot of {trigger_word} person, dynamic pose, dramatic lighting, movie poster style, detailed, epic, 8k",
        "negative_prompt": "static, boring, blurry, deformed, low quality, bad anatomy"
    },
    {
        "name": "Book Cover Author",
        "category": "author",
        "prompt_template": "author portrait of {trigger_word} person, thoughtful expression, moody lighting, bookshelf background, literary atmosphere, professional photography, 8k",
        "negative_prompt": "cartoon, blurry, deformed, casual, ugly"
    }
]
```

---

## 9. Answer: Does This App Need Training?

**Short answer: Yes, for anything beyond quick one-off headshots.**

| Use Case | Training Needed? | Method | Consistency |
|----------|-----------------|--------|-------------|
| "Give me a quick headshot variant" | No | Flux Headshot / Face Gen | ~70% match |
| "Show me in different outfits" | No | IP Adapter on text2img | ~60% match |
| "Generate 50 images that all look like the same character" | **YES** | LoRA fine-tune + text2img | ~95% match |
| "Create a consistent AI character for my book" | **YES** | LoRA fine-tune + text2img | ~95% match |
| "Same face, different art styles (anime, realistic, oil painting)" | **YES** | LoRA + style prompts/multi-LoRA | ~90% match |

**The app should support both paths** — quick mode for instant gratification, LoRA mode for serious character work. The training is $1 and takes ~15-30 minutes, so there's no reason not to make it the default recommendation for any character you'll use more than once.

---

## 10. Implementation Phases

### Phase 1 — MVP (Core Generation Loop)
- API key config + storage
- Quick Mode: Flux Headshot + Face Gen generation from uploaded face
- Basic prompt builder with presets
- Generation history (SQLite)
- Image gallery with download
- Async polling for processing results

### Phase 2 — LoRA Training Pipeline
- Character profile creation
- Training image upload + URL hosting
- LoRA training submission + status monitoring
- Generate with trained LoRA
- Trigger word management

### Phase 3 — Advanced Generation
- IP Adapter reference mode
- ControlNet pose control
- Img2Img variations from existing generations
- Multi-LoRA (combine character LoRA with style LoRAs)
- Inpainting editor

### Phase 4 — Polish
- Super Resolution upscaling
- Background removal
- Outpainting
- Batch operations
- Prompt history + search
- Export character packs (all images + metadata)

---

## 11. File Structure

```
facelock/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── index.tsx              # Dashboard
│   │   │   ├── characters/
│   │   │   │   ├── index.tsx          # Character list
│   │   │   │   ├── [id].tsx           # Character detail
│   │   │   │   └── [id]/train.tsx     # Training wizard
│   │   │   ├── generate/
│   │   │   │   ├── index.tsx          # LoRA generation
│   │   │   │   └── quick.tsx          # Quick mode
│   │   │   ├── gallery.tsx            # Image gallery
│   │   │   └── settings.tsx           # Config
│   │   ├── components/
│   │   │   ├── PromptBuilder.tsx
│   │   │   ├── ImageGrid.tsx
│   │   │   ├── CharacterCard.tsx
│   │   │   ├── TrainingStatus.tsx
│   │   │   ├── ParameterSliders.tsx
│   │   │   └── StylePresets.tsx
│   │   ├── hooks/
│   │   │   ├── useGeneration.ts
│   │   │   ├── usePolling.ts
│   │   │   └── useCharacter.ts
│   │   └── lib/
│   │       ├── modelslab.ts           # API client wrapper
│   │       └── db.ts                  # SQLite client
│   └── package.json
├── backend/
│   ├── main.py                        # FastAPI app
│   ├── routes/
│   │   ├── characters.py
│   │   ├── generate.py
│   │   ├── training.py
│   │   ├── gallery.py
│   │   └── webhooks.py
│   ├── services/
│   │   ├── modelslab_client.py        # API wrapper
│   │   ├── polling_service.py         # Async poll manager
│   │   ├── image_storage.py           # Local file management
│   │   └── training_service.py        # LoRA training orchestration
│   ├── models/
│   │   └── database.py                # SQLite models
│   └── requirements.txt
├── storage/
│   ├── characters/                    # Training images by character
│   ├── generations/                   # Downloaded outputs
│   └── temp/                          # Temp uploads
├── MODELSLAB_API_REFERENCE.md         # ← The reference doc
├── .env                               # MODELSLAB_API_KEY=xxx
└── README.md
```

---

## 12. Environment Variables

```env
MODELSLAB_API_KEY=your_api_key_here
DATABASE_PATH=./storage/facelock.db
IMAGE_STORAGE_PATH=./storage
DEFAULT_MODEL_ID=sdxl
DEFAULT_LORA_BASE=sdxl
DEFAULT_GUIDANCE_SCALE=7.5
DEFAULT_NUM_STEPS=31
DEFAULT_WIDTH=1024
DEFAULT_HEIGHT=1024
```

---

## 13. Dependencies

### Backend (Python)
```
fastapi
uvicorn
sqlalchemy
aiohttp
requests
python-multipart
pillow
python-dotenv
```

### Frontend (Node)
```
next
react
tailwindcss
shadcn/ui
swr (or tanstack-query)
lucide-react
```

---

## 14. Key Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Training images need public URLs | Use ModelsLab's base64_to_url endpoint or serve locally via ngrok/temp hosting |
| LoRA training fails | Store training params, allow retry. Show clear error messages from API |
| Image URLs expire (24hr for temp) | Auto-download to local storage on generation complete |
| Rate limiting | Queue requests, respect limits, show queue position to user |
| IP Adapter consistency varies | Document that LoRA mode is recommended; Quick Mode is for experiments |
| ModelsLab API downtime | Graceful error handling, retry logic with exponential backoff |
