from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio

from app.api.v1 import auth, dashboard, tasks, projects, notes, analytics, github, ws
from app.core.config import settings
from app.core.websockets import manager
from app.core.redis import redis_client
from app.db.session import engine
from sqlalchemy import text

@asynccontextmanager
async def lifespan(app: FastAPI):
    await redis_client.init_redis()
    pubsub_task = asyncio.create_task(manager.listen_to_redis())
    try:
        yield
    finally:
        pubsub_task.cancel()
        await asyncio.gather(pubsub_task, return_exceptions=True)
        await redis_client.close()
        await engine.dispose()

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
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "tasknest-api"}

@app.get("/ready")
async def readiness_check():
    checks = {"database": False, "redis": False}
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
        checks["database"] = True
    except Exception:
        pass

    checks["redis"] = await redis_client.is_healthy()
    if not all(checks.values()):
        raise HTTPException(status_code=503, detail={"status": "not_ready", "checks": checks})
    return {"status": "ready", "checks": checks}

app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(dashboard.router, prefix=f"{settings.API_V1_STR}/dashboard", tags=["dashboard"])
app.include_router(tasks.router, prefix=f"{settings.API_V1_STR}/tasks", tags=["tasks"])
app.include_router(projects.router, prefix=f"{settings.API_V1_STR}/projects", tags=["projects"])
app.include_router(notes.router, prefix=f"{settings.API_V1_STR}/notes", tags=["notes"])
app.include_router(analytics.router, prefix=f"{settings.API_V1_STR}/analytics", tags=["analytics"])
app.include_router(github.router, prefix=f"{settings.API_V1_STR}/github", tags=["github"])
app.include_router(ws.router, prefix=f"{settings.API_V1_STR}", tags=["websockets"])
