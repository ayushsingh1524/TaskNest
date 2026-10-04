import json
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload

from app.api import deps
from app.models.user import User
from app.models.note import Note, NoteVersion
from app.models.project import Project
from app.schemas.note import NoteCreate, NoteUpdate, NoteResponse, NoteDetailResponse
from app.core.redis import redis_client

router = APIRouter()

async def invalidate_note_cache(user_id: int):
    """Helper to invalidate Redis cache for notes."""
    try:
        if redis_client.redis:
            keys = await redis_client.redis.keys(f"user:{user_id}:notes:*")
            if keys:
                await redis_client.redis.delete(*keys)
    except Exception as e:
        print(f"Failed to invalidate note cache: {e}")

@router.get("", response_model=List[NoteResponse])
async def get_notes(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    search: Optional[str] = None,
    project_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve notes for current user.
    """
    cache_key = f"user:{current_user.id}:notes:list:{search}:{project_id}:{skip}:{limit}"
    
    if redis_client.redis:
        cached_data = await redis_client.redis.get(cache_key)
        if cached_data:
            return json.loads(cached_data)

    query = select(Note).where(Note.user_id == current_user.id)
    
    if project_id is not None:
        query = query.where(Note.project_id == project_id)

    if search:
        query = query.where(
            or_(
                Note.title.ilike(f"%{search}%"),
                Note.markdown_content.ilike(f"%{search}%")
            )
        )

    query = query.order_by(Note.updated_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    notes = result.scalars().all()

    response_data = [NoteResponse.model_validate(n).model_dump(mode='json') for n in notes]
    if redis_client.redis:
        await redis_client.redis.setex(cache_key, 300, json.dumps(response_data))

    return response_data

@router.post("", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
async def create_note(
    *,
    db: AsyncSession = Depends(deps.get_db),
    note_in: NoteCreate,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Create a new note.
    """
    note_data = note_in.model_dump()
    if note_data.get("project_id") is not None:
        project_result = await db.execute(
            select(Project.id).where(
                Project.id == note_data["project_id"],
                Project.user_id == current_user.id,
            )
        )
        if project_result.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Project not found")

    note = Note(
        **note_data,
        user_id=current_user.id
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)

    await invalidate_note_cache(current_user.id)
    return note

@router.get("/{note_id}", response_model=NoteDetailResponse)
async def get_note(
    *,
    db: AsyncSession = Depends(deps.get_db),
    note_id: int,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get note details including version history.
    """
    query = (
        select(Note)
        .options(selectinload(Note.versions))
        .where(Note.id == note_id)
    )
    result = await db.execute(query)
    note = result.scalars().first()

    if not note or note.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Note not found")

    # Sort versions by latest first
    note.versions.sort(key=lambda v: v.created_at, reverse=True)
    return note

@router.patch("/{note_id}", response_model=NoteResponse)
async def update_note(
    *,
    db: AsyncSession = Depends(deps.get_db),
    note_id: int,
    note_in: NoteUpdate,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Update a note. Creates a version snapshot if content is modified.
    """
    query = select(Note).where(Note.id == note_id)
    result = await db.execute(query)
    note = result.scalars().first()

    if not note or note.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Note not found")

    update_data = note_in.model_dump(exclude_unset=True)

    if "project_id" in update_data and update_data["project_id"] is not None:
        project_result = await db.execute(
            select(Project.id).where(
                Project.id == update_data["project_id"],
                Project.user_id == current_user.id,
            )
        )
        if project_result.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Project not found")
    
    # Snapshot logic: if markdown_content is being updated and has changed
    if "markdown_content" in update_data and update_data["markdown_content"] != note.markdown_content:
        # Save current state to history before overwriting
        if note.markdown_content:
            version_snapshot = NoteVersion(
                note_id=note.id,
                markdown_content=note.markdown_content
            )
            db.add(version_snapshot)

    for field, value in update_data.items():
        setattr(note, field, value)

    await db.commit()
    await db.refresh(note)

    await invalidate_note_cache(current_user.id)
    return note

@router.delete("/{note_id}", response_model=NoteResponse)
async def delete_note(
    *,
    db: AsyncSession = Depends(deps.get_db),
    note_id: int,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Delete a note.
    """
    query = select(Note).where(Note.id == note_id)
    result = await db.execute(query)
    note = result.scalars().first()

    if not note or note.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Note not found")

    await db.delete(note)
    await db.commit()

    await invalidate_note_cache(current_user.id)
    return note
