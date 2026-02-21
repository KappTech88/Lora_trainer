import base64
import uuid
from pathlib import Path

import httpx
from fastapi import UploadFile

from app.config import settings

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


class ImageStorageService:
    def __init__(self):
        self.base_path = Path(settings.image_storage_path).resolve()
        self.base_path.mkdir(parents=True, exist_ok=True)

    def _ensure_dir(self, path: Path) -> None:
        path.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _validate_upload(file: UploadFile, content: bytes) -> str:
        """Validate file extension and size. Returns the sanitized extension."""
        ext = Path(file.filename or "image.png").suffix.lower() or ".png"
        if ext not in ALLOWED_EXTENSIONS:
            raise ValueError(
                f"File type '{ext}' not allowed. Accepted: {', '.join(ALLOWED_EXTENSIONS)}"
            )
        if len(content) > MAX_FILE_SIZE:
            raise ValueError(
                f"File too large ({len(content)} bytes). Maximum: {MAX_FILE_SIZE} bytes"
            )
        return ext

    async def save_uploaded_image(
        self, file: UploadFile, character_id: str, image_type: str = "training"
    ) -> tuple[str, str]:
        """Save an uploaded file. Returns (relative_path, filename)."""
        content = await file.read()
        ext = self._validate_upload(file, content)

        subdir = "characters" if image_type in ("training", "reference") else "temp"
        dir_path = self.base_path / subdir / character_id
        self._ensure_dir(dir_path)

        filename = f"{uuid.uuid4()}{ext}"
        file_path = dir_path / filename
        file_path.write_bytes(content)

        relative_path = f"{subdir}/{character_id}/{filename}"
        return relative_path, filename

    async def save_temp_image(self, file: UploadFile) -> tuple[str, str]:
        """Save a temporary upload. Returns (relative_path, filename)."""
        content = await file.read()
        ext = self._validate_upload(file, content)

        dir_path = self.base_path / "temp"
        self._ensure_dir(dir_path)

        filename = f"{uuid.uuid4()}{ext}"
        file_path = dir_path / filename
        file_path.write_bytes(content)

        relative_path = f"temp/{filename}"
        return relative_path, filename

    async def download_remote_image(
        self, url: str, generation_id: str, index: int = 0
    ) -> str:
        """Download a remote image to local storage. Returns relative path."""
        dir_path = self.base_path / "generations" / generation_id
        self._ensure_dir(dir_path)

        filename = f"{index}.png"
        file_path = dir_path / filename

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            file_path.write_bytes(resp.content)

        return f"generations/{generation_id}/{filename}"

    def get_absolute_path(self, relative_path: str) -> Path:
        """Resolve a relative storage path to absolute, with traversal protection."""
        abs_path = (self.base_path / relative_path).resolve()
        if not abs_path.is_relative_to(self.base_path):
            raise ValueError("Invalid path: traversal outside storage directory")
        return abs_path

    def read_as_base64(self, relative_path: str) -> str:
        """Read a file and return its base64-encoded content."""
        abs_path = self.get_absolute_path(relative_path)
        data = abs_path.read_bytes()
        return base64.b64encode(data).decode("utf-8")

    def delete_image(self, relative_path: str) -> None:
        """Delete an image file."""
        abs_path = self.get_absolute_path(relative_path)
        if abs_path.exists():
            abs_path.unlink()

    def delete_directory(self, relative_path: str) -> None:
        """Delete a directory and all its contents."""
        abs_path = self.get_absolute_path(relative_path)
        if abs_path.exists() and abs_path.is_dir():
            import shutil
            shutil.rmtree(abs_path)
