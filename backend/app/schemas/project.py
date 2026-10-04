from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
from app.schemas.user import UserResponse
from app.schemas.task import TaskResponse

class ProjectBase(BaseModel):
    title: str
    description: Optional[str] = None
    status: str = "active"
    deadline: Optional[datetime] = None

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    deadline: Optional[datetime] = None

class ProjectResponse(ProjectBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    owner: Optional[UserResponse] = None

    model_config = ConfigDict(from_attributes=True)

from app.schemas.github import ProjectGithubRepoResponse, GithubActivityResponse

class ProjectAnalytics(BaseModel):
    total_tasks: int
    completed_tasks: int
    completion_percentage: int
    overdue_tasks: int
    pending_tasks: int
    github_commits: int = 0
    github_pull_requests: int = 0
    github_activity_7d: int = 0
    github_activity_30d: int = 0
    last_github_activity_at: Optional[datetime] = None
    health_score: int = 100
    health_status: str = "healthy"

class ProjectDetailResponse(ProjectResponse):
    tasks: List[TaskResponse] = []
    github_repos: List[ProjectGithubRepoResponse] = []
    github_activities: List[GithubActivityResponse] = []
    analytics: Optional[ProjectAnalytics] = None

    model_config = ConfigDict(from_attributes=True)
