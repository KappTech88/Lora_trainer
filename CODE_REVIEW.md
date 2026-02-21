# Code Review: FaceLock — LoRA Trainer

## Overview

Full-stack application (FastAPI + Next.js) for training LoRA models on character images and generating consistent AI character images via the ModelsLab API. The codebase is well-structured with clean separation between frontend/backend, proper use of async patterns, and a modern UI stack.

---

## Critical Issues

### 1. `.env` file is committed to version control

**File:** `.env`
**Severity:** High
**Issue:** The `.env` file is tracked by git. While the API key field is currently empty, this file will capture real secrets as soon as a user sets one. The `.gitignore` only excludes `.env.local`, not `.env`.

**Fix:** Add `.env` to `.gitignore` and remove it from tracking:
```
# .gitignore
.env
.env.local
```

### 2. API key stored only in-memory — lost on restart

**Files:** `backend/app/routes/settings.py:30-34`, `backend/app/services/modelslab_client.py:17-18`
**Severity:** High
**Issue:** `update_api_key` mutates the in-memory `settings` object and the client instance, but never writes back to `.env` or any persistent store. The API key is lost when the server restarts.

**Fix:** Persist the key to `.env` or a database settings table when updated through the API.

### 3. Path traversal in `ImageStorageService`

**File:** `backend/app/services/image_storage.py:69-71`
**Severity:** High
**Issue:** `get_absolute_path` joins a user-influenced `relative_path` directly to `base_path` without validating that the resolved path stays inside `base_path`. A malicious `relative_path` like `../../etc/passwd` would escape the storage directory. This affects `read_as_base64`, `delete_image`, and `delete_directory`.

**Fix:** Validate that the resolved path is a child of `base_path`:
```python
def get_absolute_path(self, relative_path: str) -> Path:
    abs_path = (self.base_path / relative_path).resolve()
    if not abs_path.is_relative_to(self.base_path):
        raise ValueError("Path traversal detected")
    return abs_path
```

### 4. No HTTP error handling in ModelsLab client

**File:** `backend/app/services/modelslab_client.py`
**Severity:** High
**Issue:** Every API call does `resp.json()` without checking `resp.status_code` or calling `resp.raise_for_status()`. A 500 or 429 from ModelsLab will either throw a JSON parse error or silently return an error body that gets treated as a valid result. This can lead to silent data corruption (e.g., saving `None` as a training_id).

**Fix:** Add `resp.raise_for_status()` before `.json()` in every method, or add a shared `_request` method:
```python
async def _request(self, method: str, url: str, **kwargs) -> dict:
    resp = await self.client.request(method, url, **kwargs)
    resp.raise_for_status()
    return resp.json()
```

---

## Bugs

### 5. N+1 query in `list_characters`

**File:** `backend/app/routes/characters.py:25-52`
**Severity:** Medium
**Issue:** For each character, a separate COUNT query is issued for image count. With 50 characters this means 51 queries.

**Fix:** Use a single query with a subquery or `joinedload`:
```python
from sqlalchemy import func, select
subq = (
    select(CharacterImage.character_id, func.count(CharacterImage.id).label("cnt"))
    .group_by(CharacterImage.character_id)
    .subquery()
)
query = select(Character, subq.c.cnt).outerjoin(subq, Character.id == subq.c.character_id)
```

### 6. `_gen_to_response` duplicated across two modules

**Files:** `backend/app/routes/generate.py:23-39`, `backend/app/routes/gallery.py:18-34`
**Severity:** Low
**Issue:** Identical helper function defined in two route files. If the schema changes, both must be updated in lockstep.

**Fix:** Extract to a shared utility module (e.g., `app/routes/utils.py` or a classmethod on `GenerationResponse`).

### 7. `upload_face_image` calls `get_services()` twice

**File:** `backend/app/routes/generate.py:247-248`
**Severity:** Low
**Issue:**
```python
_, _, storage = get_services()
client, _, _ = get_services()
```
This calls the function twice for no reason.

**Fix:**
```python
client, _, storage = get_services()
```

### 8. Object URL memory leak in Quick Generate page

**File:** `frontend/src/app/generate/quick/page.tsx:55, 66`
**Severity:** Low
**Issue:** `URL.createObjectURL(file)` is called but `URL.revokeObjectURL()` is never called when the preview is cleared or component unmounts. This leaks blob references.

**Fix:** Revoke the previous URL before setting a new one:
```typescript
if (facePreview) URL.revokeObjectURL(facePreview);
setFacePreview(URL.createObjectURL(file));
```
And add a cleanup effect:
```typescript
useEffect(() => {
  return () => { if (facePreview) URL.revokeObjectURL(facePreview); };
}, [facePreview]);
```

### 9. Polling tasks are fire-and-forget with no cancellation on shutdown

**File:** `backend/app/services/polling_service.py:32-35`
**Severity:** Medium
**Issue:** `asyncio.create_task` spawns background tasks, but the `lifespan` shutdown handler doesn't cancel them. Active polling tasks will raise `CancelledError` or produce warnings on shutdown.

**Fix:** Cancel active polls during shutdown:
```python
# In lifespan shutdown:
polling_service.cancel_all()

# In PollingService:
def cancel_all(self):
    for task in self.active_polls.values():
        task.cancel()
    self.active_polls.clear()
```

### 10. `Content-Type: application/json` header sent on file upload requests

**File:** `frontend/src/lib/api.ts:17-18`
**Severity:** Medium
**Issue:** `fetchApi` always sets `Content-Type: application/json`. The `uploadCharacterImages` and `uploadFaceImage` methods bypass `fetchApi` to avoid this, but if anyone mistakenly uses `fetchApi` for a multipart request, it will break. The default header also overrides any explicit `Content-Type` set in `options.headers` because it's spread first.

**Fix:** Only set `Content-Type` when body is not `FormData`, and reverse the spread order:
```typescript
const headers: HeadersInit = {
    ...options?.headers,
};
if (!(options?.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
}
```

---

## Security Concerns

### 11. No input validation on file uploads

**Files:** `backend/app/routes/characters.py:190-232`, `backend/app/routes/generate.py:241-265`
**Severity:** Medium
**Issue:** No validation of:
- File content type (could upload `.exe` or `.html`)
- File size (could upload multi-GB files to exhaust disk)
- File extension (extension is taken directly from client-supplied filename)

**Fix:** Validate MIME type, enforce file size limits, and whitelist allowed extensions:
```python
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
```

### 12. `image_type` form parameter is not validated

**File:** `backend/app/routes/characters.py:193`
**Severity:** Low
**Issue:** `image_type: str = Form("training")` accepts any string. A user could pass arbitrary values that may cause unexpected behavior downstream.

**Fix:** Validate against allowed values:
```python
if image_type not in ("training", "reference"):
    raise HTTPException(status_code=400, detail="Invalid image type")
```

### 13. Webhook endpoints have no authentication

**File:** `backend/app/routes/webhooks.py`
**Severity:** Medium
**Issue:** The webhook endpoints accept any POST request without verifying the sender is actually ModelsLab. An attacker could send forged callbacks.

**Fix:** Verify a shared secret or signature header from ModelsLab, or restrict by IP if the provider documents their IP ranges.

### 14. CORS allows credentials with broad method/header wildcards

**File:** `backend/app/main.py:114-120`
**Severity:** Low (development config)
**Issue:** `allow_methods=["*"]` and `allow_headers=["*"]` with `allow_credentials=True` is overly permissive. Acceptable for local development but should be tightened for production.

---

## Architecture & Design

### 15. Global mutable service singletons

**File:** `backend/app/main.py:27-30`
**Severity:** Medium (design smell)
**Issue:** Services are instantiated as module-level globals. Routes access them via deferred imports (`from app.main import ...`), creating a circular-import-prone pattern. This makes testing harder since you can't easily inject mocks.

**Fix:** Use FastAPI's dependency injection system with `app.state` or `Depends()` to provide services.

### 16. `async_session` used directly in `PollingService` bypasses dependency injection

**File:** `backend/app/services/polling_service.py:104`
**Severity:** Medium
**Issue:** `_update_generation` creates its own session with `async_session()` instead of receiving one through DI. This means it won't participate in any request-scoped transaction and makes the code harder to test.

### 17. Database model uses `String` primary keys instead of proper UUID type

**File:** `backend/app/models/database.py`
**Severity:** Low
**Issue:** All primary keys are `Column(String, default=lambda: str(uuid.uuid4()))`. SQLite doesn't have a native UUID type, but using string comparison for UUIDs is slower and more error-prone than using a dedicated UUID column type or at minimum a fixed-length `CHAR(36)`.

### 18. No database migrations strategy

**Severity:** Medium
**Issue:** `init_db()` uses `Base.metadata.create_all` which only creates new tables — it won't modify existing tables when schemas change. Any schema evolution will silently fail or require manual intervention.

**Fix:** Use Alembic for migrations.

---

## Frontend

### 19. No loading/error boundaries for async pages

**Severity:** Low
**Issue:** Most pages don't have proper error boundaries. If a query fails, the page may render incomplete rather than showing an error state. Only the LoRA Generate page has a Suspense boundary.

### 20. Hardcoded `http://localhost:8000` fallback

**File:** `frontend/src/lib/constants.ts:39-40`
**Severity:** Low (expected for dev)
**Issue:** The API base URL defaults to localhost. This is fine for development but there's no documentation about setting `NEXT_PUBLIC_API_URL` for production.

### 21. Gallery query key includes mutable object reference

**File:** `frontend/src/app/gallery/page.tsx:60`
**Severity:** Low
**Issue:** `queryKey: ["gallery", params]` where `params` is a new object every render. React Query does deep comparison, so it works, but it would be more idiomatic to use stable primitives:
```typescript
queryKey: ["gallery", statusFilter, favOnly, characterFilter],
```

---

## Summary

| Category | Critical | Medium | Low |
|----------|----------|--------|-----|
| Security | 2 (path traversal, .env in git) | 3 (no upload validation, no webhook auth, no HTTP error handling) | 2 |
| Bugs | 0 | 2 (N+1 queries, polling cleanup) | 3 |
| Design | 0 | 3 (global singletons, no migrations, session bypass) | 3 |

**Top priorities:**
1. Add `.env` to `.gitignore` and remove from tracking
2. Fix path traversal in `ImageStorageService.get_absolute_path`
3. Add `raise_for_status()` to all `ModelsLabClient` methods
4. Persist API key updates to disk
5. Add file upload validation (type, size)
