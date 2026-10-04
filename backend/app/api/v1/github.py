import os
import json
import hashlib
import hmac
from typing import Any, Dict
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import httpx
from app.db.session import AsyncSessionLocal

from app.api import deps
from app.models.user import User
from app.models.github import GithubStat, ProjectGithubRepo, GithubActivity
from app.models.task import Task
from app.models.project import Project
from app.schemas.github import GithubStatusResponse, GithubStatResponse, GithubConnectRequest
from app.core.redis import redis_client
from app.core.config import settings
from app.core.security import encrypt_github_token, decrypt_github_token
from app.core.websockets import manager
import re
from fastapi import Request

router = APIRouter()

TASK_CLOSE_PATTERN = re.compile(r"(?:fix|fixes|fixed|close|closes|closed|resolve|resolves|resolved)\\s+#(\\d+)", re.IGNORECASE)

async def _complete_referenced_tasks(db: AsyncSession, project_id: int, text: str) -> list[int]:
    completed: list[int] = []
    for task_id_text in TASK_CLOSE_PATTERN.findall(text or ""):
        task_result = await db.execute(
            select(Task).where(Task.id == int(task_id_text), Task.project_id == project_id)
        )
        task = task_result.scalars().first()
        if task and task.status != "completed":
            task.status = "completed"
            completed.append(task.id)
    return completed


async def _github_get(client: httpx.AsyncClient, url: str, headers: dict) -> httpx.Response:
    response = await client.get(url, headers=headers, timeout=20.0)
    if response.status_code == 401:
        raise ValueError("GitHub credentials are no longer valid")
    response.raise_for_status()
    return response


async def sync_github_data(user_id: int, access_token: str):
    """Synchronize real repository, language, commit and pull-request metrics."""
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    try:
        async with httpx.AsyncClient(follow_redirects=True) as client:
            user_resp = await _github_get(client, "https://api.github.com/user", headers)
            username = user_resp.json().get("login")
            if not username:
                raise ValueError("GitHub account has no login")

            repos_data = []
            page = 1
            while True:
                response = await _github_get(
                    client,
                    f"https://api.github.com/user/repos?per_page=100&page={page}&affiliation=owner,collaborator&sort=updated",
                    headers,
                )
                batch = response.json()
                repos_data.extend(batch)
                if len(batch) < 100:
                    break
                page += 1

            language_bytes: Dict[str, int] = {}
            for repo in repos_data[:25]:
                languages_url = repo.get("languages_url")
                if not languages_url:
                    continue
                response = await _github_get(client, languages_url, headers)
                for language, byte_count in response.json().items():
                    language_bytes[language] = language_bytes.get(language, 0) + int(byte_count)

            total_bytes = sum(language_bytes.values())
            top_langs = {}
            if total_bytes:
                ranked = sorted(language_bytes.items(), key=lambda item: item[1], reverse=True)[:8]
                top_langs = {
                    language: round((byte_count / total_bytes) * 100, 1)
                    for language, byte_count in ranked
                }

            commit_search = await _github_get(
                client,
                f"https://api.github.com/search/commits?q=author:{username}&per_page=1",
                headers,
            )
            pr_search = await _github_get(
                client,
                f"https://api.github.com/search/issues?q=author:{username}+type:pr&per_page=1",
                headers,
            )

            commits = int(commit_search.json().get("total_count", 0))
            prs = int(pr_search.json().get("total_count", 0))
            repos = len(repos_data)

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(GithubStat).where(GithubStat.user_id == user_id))
            stat = result.scalars().first()
            if not stat:
                stat = GithubStat(user_id=user_id)
                db.add(stat)

            stat.commits = commits
            stat.repositories = repos
            stat.pull_requests = prs
            stat.top_languages = top_langs
            stat.updated_at = datetime.now(timezone.utc)
            await db.commit()

        if redis_client.redis:
            await redis_client.redis.delete(f"user:{user_id}:github:stats")
    except Exception:
        # Preserve the last successful snapshot rather than replacing it with fabricated data.
        raise


@router.get("/status", response_model=GithubStatusResponse)
async def get_status(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """Check if the user is connected to GitHub."""
    query = select(GithubStat.updated_at).where(GithubStat.user_id == current_user.id)
    result = await db.execute(query)
    last_synced = result.scalar()
    
    return GithubStatusResponse(
        is_connected=bool(current_user.github_access_token),
        username=current_user.github_username,
        last_synced=last_synced
    )

@router.post("/connect")
async def connect_github(
    *,
    payload: GithubConnectRequest,
    db: AsyncSession = Depends(deps.get_db),
    background_tasks: BackgroundTasks,
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    Connects GitHub account using PAT.
    """
    if not payload.token:
        raise HTTPException(status_code=400, detail="Token is required")
        
    # Verify token and get username
    async with httpx.AsyncClient() as client:
        resp = await client.get("https://api.github.com/user", headers={
            "Authorization": f"Bearer {payload.token}",
            "Accept": "application/vnd.github.v3+json"
        })
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Invalid GitHub Token")
            
        username = resp.json().get("login")

    try:
        current_user.github_access_token = encrypt_github_token(payload.token)
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=503, detail="GitHub credential encryption is not configured") from exc
    current_user.github_username = username
    await db.commit()
    
    # Trigger initial sync
    background_tasks.add_task(sync_github_data, current_user.id, payload.token)
    
    return {"status": "success", "message": "Connected to GitHub"}

@router.post("/disconnect")
async def disconnect_github(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """Removes Github connection."""
    current_user.github_access_token = None
    current_user.github_username = None
    
    # Remove stats
    query = select(GithubStat).where(GithubStat.user_id == current_user.id)
    result = await db.execute(query)
    stat = result.scalars().first()
    if stat:
        await db.delete(stat)
        
    await db.commit()
    
    if redis_client.redis:
        await redis_client.redis.delete(f"user:{current_user.id}:github:stats")
        
    return {"status": "success"}

@router.post("/sync")
async def trigger_sync(
    *,
    db: AsyncSession = Depends(deps.get_db),
    background_tasks: BackgroundTasks,
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """Manually trigger a background sync job."""
    if not current_user.github_access_token:
        raise HTTPException(status_code=400, detail="GitHub not connected")
        
    try:
        access_token = decrypt_github_token(current_user.github_access_token)
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=503, detail="GitHub credential is unavailable") from exc

    background_tasks.add_task(sync_github_data, current_user.id, access_token)
    return {"status": "sync_started"}

@router.get("/stats", response_model=GithubStatResponse)
async def get_stats(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """Get aggregated GitHub stats from the database."""
    if not current_user.github_access_token:
        raise HTTPException(status_code=400, detail="GitHub not connected")

    cache_key = f"user:{current_user.id}:github:stats"
    if redis_client.redis:
        cached = await redis_client.redis.get(cache_key)
        if cached:
            return json.loads(cached)

    query = select(GithubStat).where(GithubStat.user_id == current_user.id)
    result = await db.execute(query)
    stat = result.scalars().first()

    if not stat:
        # Fallback empty response if sync hasn't finished
        return {
            "id": 0,
            "user_id": current_user.id,
            "commits": 0,
            "repositories": 0,
            "pull_requests": 0,
            "top_languages": {},
            "updated_at": datetime.now(timezone.utc)
        }

    response_data = GithubStatResponse.model_validate(stat).model_dump(mode='json')
    
    if redis_client.redis:
        await redis_client.redis.setex(cache_key, 3600, json.dumps(response_data))

    return response_data

@router.post("/webhook")
async def github_webhook(request: Request, db: AsyncSession = Depends(deps.get_db)):
    """Receive authenticated GitHub push and pull-request events."""
    if not settings.GITHUB_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="GitHub webhook is not configured")

    body = await request.body()
    signature = request.headers.get("x-hub-signature-256", "")
    expected = "sha256=" + hmac.new(
        settings.GITHUB_WEBHOOK_SECRET.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    delivery_id = request.headers.get("x-github-delivery", "")
    if not delivery_id:
        raise HTTPException(status_code=400, detail="Missing GitHub delivery ID")

    delivery_key = f"github:webhook:delivery:{delivery_id}"
    if redis_client.redis:
        is_new = await redis_client.redis.set(delivery_key, "processing", ex=86400, nx=True)
        if not is_new:
            return {"status": "ignored", "reason": "duplicate delivery"}

    try:
        try:
            payload = json.loads(body)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=400, detail="Malformed webhook payload") from exc

        event = request.headers.get("x-github-event")
        if event not in {"push", "pull_request"}:
            return {"status": "ignored", "reason": f"unsupported event type: {event}"}

        repo_full_name = payload.get("repository", {}).get("full_name")
        if not repo_full_name:
            return {"status": "ignored", "reason": "missing repository"}

        result = await db.execute(
            select(ProjectGithubRepo).where(ProjectGithubRepo.repo_full_name == repo_full_name)
        )
        linked_repos = result.scalars().all()
        if not linked_repos:
            return {"status": "ignored", "reason": "repo not linked to any project"}

        touched_tasks: set[int] = set()

        for linked_repo in linked_repos:
            project_id = linked_repo.project_id

            if event == "push":
                commits = payload.get("commits", [])
                for commit in commits:
                    commit_id = commit.get("id", "")
                    if not commit_id:
                        continue

                    existing = await db.execute(
                        select(GithubActivity.id).where(
                            GithubActivity.project_id == project_id,
                            GithubActivity.activity_type == "commit",
                            GithubActivity.ref_id == commit_id[:7],
                        )
                    )
                    if existing.scalar_one_or_none() is None:
                        db.add(GithubActivity(
                            project_id=project_id,
                            activity_type="commit",
                            ref_id=commit_id[:7],
                            title=commit.get("message", "No message").split("\n")[0],
                            author=commit.get("author", {}).get("name", "Unknown"),
                            url=commit.get("url", ""),
                            timestamp=datetime.fromisoformat(
                                commit.get("timestamp", datetime.now(timezone.utc).isoformat()).replace("Z", "+00:00")
                            ),
                        ))

                    touched_tasks.update(
                        await _complete_referenced_tasks(
                            db, project_id, commit.get("message", "")
                        )
                    )

            if event == "pull_request":
                action = payload.get("action", "")
                pull_request = payload.get("pull_request", {})
                number = pull_request.get("number") or payload.get("number")
                if not number:
                    continue

                ref_id = f"pr:{number}"
                existing_result = await db.execute(
                    select(GithubActivity).where(
                        GithubActivity.project_id == project_id,
                        GithubActivity.activity_type == "pull_request",
                        GithubActivity.ref_id == ref_id,
                    )
                )
                activity = existing_result.scalars().first()
                title = pull_request.get("title", f"Pull request #{number}")
                state_label = "merged" if pull_request.get("merged") else action

                if activity:
                    activity.title = f"{title} [{state_label}]"
                    activity.author = pull_request.get("user", {}).get("login", "Unknown")
                    activity.url = pull_request.get("html_url", "")
                    activity.timestamp = datetime.now(timezone.utc)
                else:
                    db.add(GithubActivity(
                        project_id=project_id,
                        activity_type="pull_request",
                        ref_id=ref_id,
                        title=f"{title} [{state_label}]",
                        author=pull_request.get("user", {}).get("login", "Unknown"),
                        url=pull_request.get("html_url", ""),
                        timestamp=datetime.now(timezone.utc),
                    ))

                if action == "closed" and pull_request.get("merged"):
                    reference_text = "\n".join([
                        pull_request.get("title") or "",
                        pull_request.get("body") or "",
                    ])
                    touched_tasks.update(
                        await _complete_referenced_tasks(db, project_id, reference_text)
                    )

        await db.commit()

        for task_id in touched_tasks:
            task_result = await db.execute(
                select(Task.owner_id, Task.assignee_id, Task.title).where(Task.id == task_id)
            )
            task_row = task_result.first()
            if task_row:
                owner_id, assignee_id, title = task_row
                targets = [owner_id]
                if assignee_id and assignee_id != owner_id:
                    targets.append(assignee_id)
                await manager.publish_event(
                    "TASK_UPDATED",
                    {"task_id": task_id, "title": title, "status": "completed", "source": "github"},
                    targets,
                )

        if redis_client.redis:
            await redis_client.redis.set(delivery_key, "processed", ex=86400)
        return {"status": "success", "tasks_completed": sorted(touched_tasks)}
    except Exception:
        await db.rollback()
        if redis_client.redis:
            await redis_client.redis.delete(delivery_key)
        raise
