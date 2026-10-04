import json
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone, timedelta

from app.api import deps
from app.models.user import User
from app.models.project import Project
from app.models.task import Task
from app.models.github import ProjectGithubRepo
from app.core.security import decrypt_github_token
import httpx
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse, ProjectDetailResponse
from app.schemas.github import ProjectGithubRepoCreate, ProjectGithubRepoResponse
from app.core.redis import redis_client

router = APIRouter()

async def invalidate_project_cache(user_id: int):
    """Helper to invalidate Redis cache for project lists."""
    try:
        if redis_client.redis:
            keys = await redis_client.redis.keys(f"user:{user_id}:projects:*")
            if keys:
                await redis_client.redis.delete(*keys)
    except Exception as e:
        print(f"Failed to invalidate project cache: {e}")

@router.get("", response_model=List[ProjectResponse])
async def get_projects(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve projects for the current user (either owned by them or accessible).
    Currently returns projects created by the user.
    """
    cache_key = f"user:{current_user.id}:projects:list:{skip}:{limit}"
    
    if redis_client.redis:
        cached_data = await redis_client.redis.get(cache_key)
        if cached_data:
            return json.loads(cached_data)

    query = (
        select(Project)
        .options(selectinload(Project.owner))
        .where(Project.user_id == current_user.id)
        .order_by(Project.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(query)
    projects = result.scalars().all()

    response_data = [ProjectResponse.model_validate(p).model_dump(mode='json') for p in projects]
    if redis_client.redis:
        await redis_client.redis.setex(cache_key, 300, json.dumps(response_data))

    return response_data


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    *,
    db: AsyncSession = Depends(deps.get_db),
    project_in: ProjectCreate,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Create a new project.
    """
    project = Project(
        **project_in.model_dump(),
        user_id=current_user.id
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)

    # Invalidate cache
    await invalidate_project_cache(current_user.id)

    # Load owner for response
    query = select(Project).options(selectinload(Project.owner)).where(Project.id == project.id)
    result = await db.execute(query)
    project = result.scalars().first()

    return project


@router.get("/{project_id}", response_model=ProjectDetailResponse)
async def get_project(
    *,
    db: AsyncSession = Depends(deps.get_db),
    project_id: int,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get project details along with calculated analytics and tasks.
    """
    query = (
        select(Project)
        .options(
            selectinload(Project.owner),
            selectinload(Project.tasks).selectinload(Task.assignee),
            selectinload(Project.tasks).selectinload(Task.owner),
            selectinload(Project.github_repos),
            selectinload(Project.github_activities)
        )
        .where(Project.id == project_id, Project.user_id == current_user.id)
    )
    result = await db.execute(query)
    project = result.scalars().first()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Analytics Calculation
    total_tasks = len(project.tasks)
    completed_tasks = sum(1 for t in project.tasks if t.status == "completed")
    pending_tasks = total_tasks - completed_tasks
    
    now = datetime.now(timezone.utc)
    overdue_tasks = sum(
        1 for t in project.tasks 
        if t.due_date and t.due_date < now and t.status != "completed"
    )

    completion_percentage = 0
    if total_tasks > 0:
        completion_percentage = int((completed_tasks / total_tasks) * 100)

    activities = list(project.github_activities)
    seven_days_ago = now - timedelta(days=7)
    thirty_days_ago = now - timedelta(days=30)

    github_commits = sum(1 for activity in activities if activity.activity_type == "commit")
    github_pull_requests = sum(1 for activity in activities if activity.activity_type == "pull_request")
    github_activity_7d = sum(1 for activity in activities if activity.timestamp >= seven_days_ago)
    github_activity_30d = sum(1 for activity in activities if activity.timestamp >= thirty_days_ago)
    last_github_activity_at = max((activity.timestamp for activity in activities), default=None)

    health_score = 100
    if total_tasks:
        pending_ratio = pending_tasks / total_tasks
        health_score -= int(pending_ratio * 30)
    health_score -= min(overdue_tasks * 10, 40)

    if project.github_repos and (
        last_github_activity_at is None or last_github_activity_at < now - timedelta(days=14)
    ):
        health_score -= 15

    if project.deadline and project.deadline < now and project.status != "completed":
        health_score -= 15

    health_score = max(0, min(100, health_score))
    if health_score >= 80:
        health_status = "healthy"
    elif health_score >= 60:
        health_status = "attention"
    else:
        health_status = "at_risk"

    analytics = {
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "completion_percentage": completion_percentage,
        "overdue_tasks": overdue_tasks,
        "pending_tasks": pending_tasks,
        "github_commits": github_commits,
        "github_pull_requests": github_pull_requests,
        "github_activity_7d": github_activity_7d,
        "github_activity_30d": github_activity_30d,
        "last_github_activity_at": last_github_activity_at,
        "health_score": health_score,
        "health_status": health_status,
    }

    # Assign analytics manually before response validation
    # Since we are returning a Pydantic model directly
    response = ProjectDetailResponse.model_validate(project)
    response.github_activities = sorted(
        response.github_activities,
        key=lambda activity: activity.timestamp,
        reverse=True,
    )
    response.analytics = analytics
    
    return response


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    *,
    db: AsyncSession = Depends(deps.get_db),
    project_id: int,
    project_in: ProjectUpdate,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Update a project.
    """
    query = select(Project).options(selectinload(Project.owner)).where(Project.id == project_id)
    result = await db.execute(query)
    project = result.scalars().first()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if project.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    update_data = project_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)

    await db.commit()
    await db.refresh(project)

    await invalidate_project_cache(current_user.id)
    return project


@router.delete("/{project_id}", response_model=ProjectResponse)
async def delete_project(
    *,
    db: AsyncSession = Depends(deps.get_db),
    project_id: int,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Delete a project. Linked tasks will have project_id set to NULL due to SET NULL constraint.
    """
    query = select(Project).options(selectinload(Project.owner)).where(Project.id == project_id)
    result = await db.execute(query)
    project = result.scalars().first()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if project.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    await db.delete(project)
    await db.commit()

    await invalidate_project_cache(current_user.id)
    return project

@router.post("/{project_id}/github_repos", response_model=ProjectGithubRepoResponse, status_code=status.HTTP_201_CREATED)
async def link_github_repo(
    *,
    db: AsyncSession = Depends(deps.get_db),
    project_id: int,
    repo_in: ProjectGithubRepoCreate,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Link a GitHub repository to a project.
    """
    query = select(Project).where(Project.id == project_id)
    result = await db.execute(query)
    project = result.scalars().first()

    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")

    if not current_user.github_access_token:
        raise HTTPException(status_code=400, detail="Connect GitHub before linking a repository")

    repo_full_name = repo_in.repo_full_name.strip()
    parts = repo_full_name.split("/")
    if len(parts) != 2 or not all(parts):
        raise HTTPException(status_code=400, detail="Repository must use owner/name format")

    existing = await db.execute(select(ProjectGithubRepo).where(
        ProjectGithubRepo.project_id == project_id,
        ProjectGithubRepo.repo_full_name == repo_full_name,
    ))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Repository already linked")

    try:
        token = decrypt_github_token(current_user.github_access_token)
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=503, detail="GitHub credential is unavailable") from exc

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            "https://api.github.com/repos/" + repo_full_name,
            headers={"Authorization": "Bearer " + token, "Accept": "application/vnd.github+json"},
        )
    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="GitHub repository not found or inaccessible")
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail="GitHub repository verification failed")

    repo = ProjectGithubRepo(
        project_id=project_id,
        repo_full_name=response.json().get("full_name", repo_full_name)
    )
    db.add(repo)
    await db.commit()
    await db.refresh(repo)

    return repo


@router.delete("/{project_id}/github_repos/{repo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unlink_github_repo(
    *,
    db: AsyncSession = Depends(deps.get_db),
    project_id: int,
    repo_id: int,
    current_user: User = Depends(deps.get_current_user),
) -> None:
    project_result = await db.execute(
        select(Project.id).where(Project.id == project_id, Project.user_id == current_user.id)
    )
    if project_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Project not found")

    repo_result = await db.execute(
        select(ProjectGithubRepo).where(
            ProjectGithubRepo.id == repo_id,
            ProjectGithubRepo.project_id == project_id,
        )
    )
    linked_repo = repo_result.scalar_one_or_none()
    if not linked_repo:
        raise HTTPException(status_code=404, detail="Linked repository not found")

    await db.delete(linked_repo)
    await db.commit()
