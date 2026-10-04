from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base import Base

class GithubStat(Base):
    __tablename__ = "github_stats"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    commits = Column(Integer, default=0)
    repositories = Column(Integer, default=0)
    pull_requests = Column(Integer, default=0)
    top_languages = Column(JSON, default=dict)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", backref="github_stat")


class ProjectGithubRepo(Base):
    __tablename__ = "project_github_repos"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    repo_full_name = Column(String, nullable=False) # e.g. "owner/TaskNest"
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="github_repos")


class GithubActivity(Base):
    __tablename__ = "github_activities"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    activity_type = Column(String, nullable=False) # "commit", "pull_request"
    ref_id = Column(String, nullable=False) # sha or PR number
    title = Column(String, nullable=False)
    author = Column(String, nullable=False)
    url = Column(String, nullable=False)
    timestamp = Column(DateTime(timezone=True), nullable=False)

    project = relationship("Project", back_populates="github_activities")
