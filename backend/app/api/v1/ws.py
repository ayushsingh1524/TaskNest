from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.redis import redis_client
from app.core.websockets import manager
from app.api.deps import get_db
from app.models.user import User

router = APIRouter()
WS_SUBPROTOCOL = "tasknest-v1"

async def get_user_from_ticket(ticket: str) -> Optional[int]:
    if not redis_client.redis:
        return None
    try:
        user_id = await redis_client.redis.getdel(f"ws:ticket:{ticket}")
        return int(user_id) if user_id else None
    except (TypeError, ValueError):
        return None

@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    db: AsyncSession = Depends(get_db)
):
    protocols = [value.strip() for value in websocket.headers.get("sec-websocket-protocol", "").split(",")]
    ticket = protocols[1] if len(protocols) == 2 and protocols[0] == WS_SUBPROTOCOL else None
    user_id = await get_user_from_ticket(ticket) if ticket else None

    if not user_id:
        await websocket.accept(subprotocol=WS_SUBPROTOCOL)
        await websocket.close(code=1008)
        return

    result = await db.execute(select(User.id).where(User.id == user_id))
    if result.scalar_one_or_none() is None:
        await websocket.accept(subprotocol=WS_SUBPROTOCOL)
        await websocket.close(code=1008)
        return

    await manager.connect(websocket, user_id)

    await manager.send_personal_message(
        {"type": "CONNECTION_ESTABLISHED", "payload": {"status": "connected"}},
        user_id
    )

    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket, user_id)
