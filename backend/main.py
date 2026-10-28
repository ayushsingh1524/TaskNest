from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio

from app.api.v1 import auth, dashboard, tasks, projects, notes, analytics, github, ws
from app.core.config import settings
from app.core.websockets import manager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start Redis Pub/Sub listener in the background
    pubsub_task = asyncio.create_task(manager.listen_to_redis())
    yield
    # Cleanup
    pubsub_task.cancel()

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for TaskNest",
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_origin_regex="https://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "API is healthy"}

app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(dashboard.router, prefix=f"{settings.API_V1_STR}/dashboard", tags=["dashboard"])
app.include_router(tasks.router, prefix=f"{settings.API_V1_STR}/tasks", tags=["tasks"])
app.include_router(projects.router, prefix=f"{settings.API_V1_STR}/projects", tags=["projects"])
app.include_router(notes.router, prefix=f"{settings.API_V1_STR}/notes", tags=["notes"])
app.include_router(analytics.router, prefix=f"{settings.API_V1_STR}/analytics", tags=["analytics"])
app.include_router(github.router, prefix=f"{settings.API_V1_STR}/github", tags=["github"])
app.include_router(ws.router, prefix=f"{settings.API_V1_STR}", tags=["websockets"])
