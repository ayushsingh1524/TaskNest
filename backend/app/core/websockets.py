import asyncio
import json
import logging
from typing import Dict, List, Optional

from fastapi import WebSocket
from app.core.redis import redis_client

logger = logging.getLogger(__name__)
EVENT_CHANNEL = "tasknest:events"


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self.active_connections.setdefault(user_id, []).append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: int):
        connections = self.active_connections.get(user_id)
        if not connections:
            return
        if websocket in connections:
            connections.remove(websocket)
        if not connections:
            self.active_connections.pop(user_id, None)

    async def send_personal_message(self, message: dict, user_id: int):
        dead_connections: List[WebSocket] = []
        for connection in list(self.active_connections.get(user_id, [])):
            try:
                await connection.send_json(message)
            except Exception:
                dead_connections.append(connection)
        for dead in dead_connections:
            self.disconnect(dead, user_id)

    async def broadcast(self, message: dict):
        for user_id in list(self.active_connections):
            await self.send_personal_message(message, user_id)

    async def _deliver(self, event: dict):
        targets = event.get("targets")
        if targets:
            for uid in targets:
                await self.send_personal_message(event, int(uid))
        else:
            await self.broadcast(event)

    async def publish_event(
        self,
        event_type: str,
        payload: dict,
        target_users: Optional[List[int]] = None,
    ):
        event = {"type": event_type, "payload": payload, "targets": target_users}
        if not redis_client.redis:
            await self._deliver(event)
            return
        try:
            await redis_client.redis.publish(EVENT_CHANNEL, json.dumps(event))
        except Exception as exc:
            logger.warning("Redis publish failed; delivering locally: %s", exc)
            await self._deliver(event)

    async def listen_to_redis(self):
        """Listen forever and reconnect with bounded exponential backoff."""
        delay = 1
        while True:
            pubsub = None
            try:
                if not redis_client.redis:
                    await redis_client.init_redis()
                if not redis_client.redis:
                    await asyncio.sleep(delay)
                    delay = min(delay * 2, 30)
                    continue

                pubsub = redis_client.redis.pubsub()
                await pubsub.subscribe(EVENT_CHANNEL)
                delay = 1
                async for message in pubsub.listen():
                    if message.get("type") != "message":
                        continue
                    try:
                        data = json.loads(message["data"])
                    except (TypeError, json.JSONDecodeError):
                        logger.warning("Ignoring malformed Redis event")
                        continue
                    await self._deliver(data)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.warning("Redis Pub/Sub disconnected: %s", exc)
                await redis_client.close()
                redis_client.redis = None
                await asyncio.sleep(delay)
                delay = min(delay * 2, 30)
            finally:
                if pubsub is not None:
                    try:
                        await pubsub.aclose()
                    except Exception:
                        pass


manager = ConnectionManager()
