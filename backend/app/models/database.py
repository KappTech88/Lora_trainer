import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, relationship

from app.config import settings


class Base(DeclarativeBase):
    pass


class Character(Base):
    __tablename__ = "characters"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    trigger_word = Column(String, nullable=True)
    lora_model_id = Column(String, nullable=True)
    lora_training_id = Column(String, nullable=True)
    lora_status = Column(String, default="none")
    lora_base_model = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    images = relationship(
        "CharacterImage", back_populates="character", cascade="all, delete-orphan"
    )
    generations = relationship("Generation", back_populates="character")


class CharacterImage(Base):
    __tablename__ = "character_images"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    character_id = Column(String, ForeignKey("characters.id"), nullable=False)
    file_path = Column(String, nullable=True)
    public_url = Column(String, nullable=True)
    image_type = Column(String, default="reference")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    character = relationship("Character", back_populates="images")


class Generation(Base):
    __tablename__ = "generations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    character_id = Column(String, ForeignKey("characters.id"), nullable=True)
    modelslab_id = Column(String, nullable=True)
    status = Column(String, default="processing")
    endpoint = Column(String, nullable=True)
    prompt = Column(Text, nullable=True)
    negative_prompt = Column(Text, nullable=True)
    params = Column(JSON, nullable=True)
    output_urls = Column(JSON, nullable=True)
    local_paths = Column(JSON, nullable=True)
    generation_time = Column(Float, nullable=True)
    seed = Column(Integer, nullable=True)
    is_favorite = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    character = relationship("Character", back_populates="generations")


class PromptPreset(Base):
    __tablename__ = "prompt_presets"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    prompt_template = Column(Text, nullable=True)
    negative_prompt = Column(Text, nullable=True)
    default_params = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


# Database engine and session
DATABASE_URL = f"sqlite+aiosqlite:///{settings.database_path}"
engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    async with async_session() as session:
        yield session
