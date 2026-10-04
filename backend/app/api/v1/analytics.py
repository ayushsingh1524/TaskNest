import json
from collections import Counter
from typing import Any
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.api import deps
from app.models.user import User
from app.models.task import Task
from app.models.project import Project
from app.models.github import GithubActivity
from app.core.redis import redis_client

router = APIRouter()


async def _owned_project_ids(db: AsyncSession, user_id: int) -> list[int]:
    result = await db.execute(select(Project.id).where(Project.user_id == user_id))
    return list(result.scalars().all())


async def _activity_dates(
    db: AsyncSession,
    user_id: int,
    start_at: datetime,
) -> tuple[list[datetime], list[datetime]]:
    task_result = await db.execute(
        select(Task.updated_at).where(
            Task.owner_id == user_id,
            Task.status == "completed",
            Task.updated_at >= start_at,
        )
    )
    task_times = [value for value in task_result.scalars().all() if value]

    project_ids = await _owned_project_ids(db, user_id)
    github_times: list[datetime] = []
    if project_ids:
        github_result = await db.execute(
            select(GithubActivity.timestamp).where(
                GithubActivity.project_id.in_(project_ids),
                GithubActivity.timestamp >= start_at,
            )
        )
        github_times = [value for value in github_result.scalars().all() if value]

    return task_times, github_times


def _current_streak(activity_days: set) -> int:
    today = datetime.now(timezone.utc).date()
    streak = 0
    cursor = today
    while cursor in activity_days:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


@router.get("/overview")
async def get_overview(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Return real high-level productivity metrics."""
    cache_key = f"user:{current_user.id}:analytics:overview"
    if redis_client.redis:
        cached_data = await redis_client.redis.get(cache_key)
        if cached_data:
            return json.loads(cached_data)

    completed_result = await db.execute(
        select(func.count(Task.id)).where(
            Task.owner_id == current_user.id,
            Task.status == "completed",
        )
    )
    total_completed = completed_result.scalar() or 0

    projects_result = await db.execute(
        select(func.count(Project.id)).where(
            Project.user_id == current_user.id,
            Project.status == "active",
        )
    )
    active_projects = projects_result.scalar() or 0

    start_at = datetime.now(timezone.utc) - timedelta(days=29)
    task_times, github_times = await _activity_dates(db, current_user.id, start_at)
    activity_days = {value.date() for value in [*task_times, *github_times]}

    data = {
        "total_completed_tasks": total_completed,
        "active_projects": active_projects,
        "current_streak_days": _current_streak(activity_days),
        "activity_events_30d": len(task_times) + len(github_times),
    }

    if redis_client.redis:
        await redis_client.redis.setex(cache_key, 300, json.dumps(data))
    return data


@router.get("/streaks")
async def get_streaks(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Return 90 days of real task-completion and GitHub activity."""
    cache_key = f"user:{current_user.id}:analytics:streaks"
    if redis_client.redis:
        cached_data = await redis_client.redis.get(cache_key)
        if cached_data:
            return json.loads(cached_data)

    today = datetime.now(timezone.utc).date()
    start_date = today - timedelta(days=89)
    start_at = datetime.combine(start_date, datetime.min.time()).replace(tzinfo=timezone.utc)

    task_times, github_times = await _activity_dates(db, current_user.id, start_at)
    task_counts = Counter(value.date() for value in task_times)
    github_counts = Counter(value.date() for value in github_times)

    heatmap_data = []
    for i in range(90):
        target_date = start_date + timedelta(days=i)
        heatmap_data.append({
            "date": target_date.isoformat(),
            "commits": github_counts[target_date],
            "tasks_completed": task_counts[target_date],
        })

    data = {"heatmap": heatmap_data}
    if redis_client.redis:
        await redis_client.redis.setex(cache_key, 300, json.dumps(data))
    return data


@router.get("/productivity")
async def get_productivity(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Return real seven-day development activity and project progress."""
    cache_key = f"user:{current_user.id}:analytics:productivity"
    if redis_client.redis:
        cached_data = await redis_client.redis.get(cache_key)
        if cached_data:
            return json.loads(cached_data)

    today = datetime.now(timezone.utc).date()
    week_start = today - timedelta(days=6)
    start_at = datetime.combine(week_start, datetime.min.time()).replace(tzinfo=timezone.utc)

    task_times, github_times = await _activity_dates(db, current_user.id, start_at)
    task_counts = Counter(value.date() for value in task_times)
    github_counts = Counter(value.date() for value in github_times)

    weekly_chart = []
    for i in range(7):
        target_date = week_start + timedelta(days=i)
        tasks = task_counts[target_date]
        github_events = github_counts[target_date]
        weekly_chart.append({
            "day": target_date.strftime("%a"),
            "date": target_date.isoformat(),
            "github_events": github_events,
            "tasks": tasks,
            "total_events": github_events + tasks,
        })

    projects_result = await db.execute(
        select(Project)
        .where(Project.user_id == current_user.id)
        .order_by(Project.updated_at.desc())
        .limit(5)
    )
    projects = projects_result.scalars().all()

    project_ids = [project.id for project in projects]
    github_30d_counts: Counter = Counter()
    if project_ids:
        activity_result = await db.execute(
            select(GithubActivity.project_id).where(
                GithubActivity.project_id.in_(project_ids),
                GithubActivity.timestamp >= datetime.now(timezone.utc) - timedelta(days=30),
            )
        )
        github_30d_counts = Counter(activity_result.scalars().all())

    project_stats = []
    now = datetime.now(timezone.utc)
    for project in projects:
        task_result = await db.execute(
            select(Task.status, Task.due_date).where(Task.project_id == project.id)
        )
        rows = task_result.all()
        total = len(rows)
        completed = sum(1 for status, _ in rows if status == "completed")
        overdue = sum(
            1
            for status, due_date in rows
            if due_date and due_date < now and status != "completed"
        )
        progress = int((completed / total) * 100) if total else 0

        project_stats.append({
            "name": project.title,
            "progress": progress,
            "total_tasks": total,
            "overdue_tasks": overdue,
            "github_activity_30d": github_30d_counts[project.id],
        })

    data = {"weekly_chart": weekly_chart, "project_stats": project_stats}
    if redis_client.redis:
        await redis_client.redis.setex(cache_key, 300, json.dumps(data))
    return data
