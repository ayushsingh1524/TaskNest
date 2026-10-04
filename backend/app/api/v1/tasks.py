import json
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, or_, and_
from sqlalchemy.orm import selectinload
from redis.asyncio import Redis

from app.api import deps
from app.core.config import settings
from app.models.user import User
from app.schemas.user import UserResponse
from app.models.task import Task, TaskComment, TaskActivity
from app.models.project import Project
from app.schemas.task import (
    TaskCreate, TaskUpdate, TaskResponse,
    CommentCreate, CommentResponse, ActivityResponse
)
from app.core.websockets import manager

router = APIRouter()

# Initialize Redis client for task caching
redis_client = Redis.from_url(settings.REDIS_URL, decode_responses=True)

async def invalidate_task_cache(user_id: int):
    try:
        pattern = f"user:{user_id}:tasks:*"
        keys = await redis_client.keys(pattern)
        if keys:
            await redis_client.delete(*keys)
    except Exception as e:
        print(f"Failed to invalidate task cache: {e}")


@router.get("", response_model=List[TaskResponse])
async def get_tasks(
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    assignee_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    # Setup cache key
    cache_key = f"user:{current_user.id}:tasks:list:status:{status}:priority:{priority}:search:{search}:assignee:{assignee_id}:skip:{skip}:limit:{limit}"
    
    try:
        cached = await redis_client.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception as e:
        print(f"Redis get error: {e}")

    # Build SQLAlchemy Query
    query = select(Task).options(
        selectinload(Task.owner),
        selectinload(Task.assignee)
    )
    
    filters = [or_(Task.owner_id == current_user.id, Task.assignee_id == current_user.id)]
    
    if status:
        filters.append(Task.status == status)
    if priority:
        filters.append(Task.priority == priority)
    if assignee_id:
        filters.append(Task.assignee_id == assignee_id)
    if search:
        filters.append(or_(
            Task.title.ilike(f"%{search}%"),
            Task.description.ilike(f"%{search}%")
        ))
        
    query = query.where(and_(*filters)) if filters else query
    query = query.order_by(Task.created_at.desc()).offset(skip).limit(limit)
    
    result = await db.execute(query)
    tasks = result.scalars().all()
    
    # Serialize tasks to JSON-compatible list
    response_data = [TaskResponse.model_validate(t).model_dump(mode="json") for t in tasks]
    
    try:
        await redis_client.set(cache_key, json.dumps(response_data), ex=30)  # cache for 30s
    except Exception as e:
        print(f"Redis set error: {e}")

    return tasks


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    task_in: TaskCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    if task_in.project_id is not None:
        project_result = await db.execute(
            select(Project.id).where(
                Project.id == task_in.project_id,
                Project.user_id == current_user.id,
            )
        )
        if project_result.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Project not found")

    if task_in.assignee_id is not None:
        assignee_result = await db.execute(
            select(User.id).where(User.id == task_in.assignee_id)
        )
        if assignee_result.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Assignee not found")

    task = Task(
        title=task_in.title,
        description=task_in.description,
        priority=task_in.priority,
        status=task_in.status,
        due_date=task_in.due_date,
        tags=task_in.tags,
        project_id=task_in.project_id,
        assignee_id=task_in.assignee_id,
        owner_id=current_user.id
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    
    # Reload with relationships
    query = select(Task).options(
        selectinload(Task.owner),
        selectinload(Task.assignee)
    ).where(Task.id == task.id)
    result = await db.execute(query)
    task_loaded = result.scalar_one()

    # Log activity
    activity = TaskActivity(
        task_id=task_loaded.id,
        user_id=current_user.id,
        activity_type="create",
        new_value=task_loaded.title
    )
    db.add(activity)
    await db.commit()

    # Invalidate cache
    await invalidate_task_cache(current_user.id)
    if task_loaded.assignee_id and task_loaded.assignee_id != current_user.id:
        await invalidate_task_cache(task_loaded.assignee_id)

    # Publish Real-time Event
    targets = [current_user.id]
    if task_loaded.assignee_id and task_loaded.assignee_id != current_user.id:
        targets.append(task_loaded.assignee_id)
    
    await manager.publish_event("TASK_CREATED", {
        "task_id": task_loaded.id,
        "title": task_loaded.title
    }, targets)

    return task_loaded


@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: int,
    task_in: TaskUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    query = select(Task).options(
        selectinload(Task.owner),
        selectinload(Task.assignee)
).where(Task.id == task_id, or_(Task.owner_id == current_user.id, Task.assignee_id == current_user.id))
    result = await db.execute(query)
    task = result.scalar_one_or_none()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    activities_to_create = []
    update_data = task_in.model_dump(exclude_unset=True)
    
    for key, value in update_data.items():
        old_val = getattr(task, key)
        if old_val != value:
            old_str = str(old_val) if old_val is not None else None
            new_str = str(value) if value is not None else None
            
            if key == "status":
                activities_to_create.append(TaskActivity(
                    task_id=task.id, user_id=current_user.id,
                    activity_type="status_change", old_value=old_str, new_value=new_str
                ))
            elif key == "priority":
                activities_to_create.append(TaskActivity(
                    task_id=task.id, user_id=current_user.id,
                    activity_type="priority_change", old_value=old_str, new_value=new_str
                ))
            elif key == "assignee_id":
                activities_to_create.append(TaskActivity(
                    task_id=task.id, user_id=current_user.id,
                    activity_type="assignee_change", old_value=old_str, new_value=new_str
                ))
            setattr(task, key, value)
            
    if activities_to_create:
        for act in activities_to_create:
            db.add(act)

    await db.commit()
    await db.refresh(task)

    # Reload relationships
    query = select(Task).options(
        selectinload(Task.owner),
        selectinload(Task.assignee)
    ).where(Task.id == task.id)
    result = await db.execute(query)
    task_loaded = result.scalar_one()

    # Invalidate cache
    await invalidate_task_cache(current_user.id)
    if task_loaded.assignee_id and task_loaded.assignee_id != current_user.id:
        await invalidate_task_cache(task_loaded.assignee_id)

    # Publish Real-time Event
    targets = [current_user.id]
    if task_loaded.assignee_id and task_loaded.assignee_id != current_user.id:
        targets.append(task_loaded.assignee_id)
    
    await manager.publish_event("TASK_UPDATED", {
        "task_id": task_loaded.id,
        "title": task_loaded.title,
        "status": task_loaded.status
    }, targets)

    return task_loaded


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: int,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    query = select(Task).where(Task.id == task_id, Task.owner_id == current_user.id)
    result = await db.execute(query)
    task = result.scalar_one_or_none()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    assignee_id = task.assignee_id
    
    await db.delete(task)
    await db.commit()

    # Invalidate caches
    await invalidate_task_cache(current_user.id)
    if assignee_id and assignee_id != current_user.id:
        await invalidate_task_cache(assignee_id)

    return None


@router.get("/{task_id}/comments", response_model=List[CommentResponse])
async def get_comments(
    task_id: int,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    task_result = await db.execute(
        select(Task.id).where(
            Task.id == task_id,
            or_(Task.owner_id == current_user.id, Task.assignee_id == current_user.id),
        )
    )
    if task_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Task not found")

    query = select(TaskComment).options(
        selectinload(TaskComment.user)
    ).where(TaskComment.task_id == task_id).order_by(TaskComment.created_at.asc())
    
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/{task_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def create_comment(
    task_id: int,
    comment_in: CommentCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    # Verify task exists
    task_query = select(Task).where(Task.id == task_id, or_(Task.owner_id == current_user.id, Task.assignee_id == current_user.id))
    task_res = await db.execute(task_query)
    if not task_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Task not found")

    comment = TaskComment(
        task_id=task_id,
        user_id=current_user.id,
        content=comment_in.content
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)

    # Reload user info
    query = select(TaskComment).options(
        selectinload(TaskComment.user)
    ).where(TaskComment.id == comment.id)
    result = await db.execute(query)
    return result.scalar_one()


@router.get("/{task_id}/activities", response_model=List[ActivityResponse])
async def get_activities(
    task_id: int,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    task_result = await db.execute(
        select(Task.id).where(
            Task.id == task_id,
            or_(Task.owner_id == current_user.id, Task.assignee_id == current_user.id),
        )
    )
    if task_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Task not found")

    query = select(TaskActivity).options(
        selectinload(TaskActivity.user)
    ).where(TaskActivity.task_id == task_id).order_by(TaskActivity.created_at.desc())
    
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/users/list", response_model=List[UserResponse])
async def get_assignees(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    result = await db.execute(select(User).order_by(User.username.asc()))
    return result.scalars().all()
