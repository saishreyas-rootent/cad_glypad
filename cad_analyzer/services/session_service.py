import uuid
from datetime import datetime, timezone, timedelta
from cad_analyzer.db.mongodb import append_activity, get_users_collection
from cad_analyzer.models.activity import ActivityEventFactory

_active_sessions: dict[str, dict] = {}
# { session_id: { "email": str, "startedAt": datetime, "lastSeen": datetime } }

SESSION_TIMEOUT_MINUTES = 60

async def create_session(email: str, ip_address: str | None = None, user_agent: str | None = None) -> str:
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat().replace("+00:00", "Z")
    session_id = str(uuid.uuid4())
    normalized_email = email.strip().lower()
    
    _active_sessions[session_id] = { "email": normalized_email, "startedAt": now, "lastSeen": now }

    # Write LOGIN event
    event = ActivityEventFactory.login(session_id, ip_address, user_agent)
    await append_activity(normalized_email, event.to_mongo())

    # Increment totalSessions counter on user doc
    await get_users_collection().update_one(
        {"email": normalized_email},
        {"$inc": {"totalSessions": 1}, "$set": {"lastActivity": now_iso}}
    )
    return session_id

def _elapsed_minutes(start_time: datetime) -> int:
    now = datetime.now(timezone.utc)
    return max(0, int((now - start_time).total_seconds() // 60))

async def close_session(session_id: str, reason: str = "Logout") -> bool:
    session = _active_sessions.pop(session_id, None)
    if session is None:
        return False

    duration = _elapsed_minutes(session["startedAt"])

    # Write LOGOUT event
    event = ActivityEventFactory.logout(session_id)
    event.metadata["reason"] = reason
    event.metadata["durationMinutes"] = duration
    await append_activity(session["email"], event.to_mongo())

    # Update totalTimeSpentMinutes
    await get_users_collection().update_one(
        {"email": session["email"]},
        {"$inc": {"totalTimeSpentMinutes": duration}}
    )
    return True

async def expire_idle_sessions():
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(minutes=SESSION_TIMEOUT_MINUTES)
    expired = [sid for sid, s in _active_sessions.items() if s["lastSeen"] < cutoff]
    for sid in expired:
        await close_session(sid, reason="IdleTimeout")

def touch_session(session_id: str):
    if session_id in _active_sessions:
        _active_sessions[session_id]["lastSeen"] = datetime.now(timezone.utc)

def get_email_for_session(session_id: str | None) -> str | None:
    if not session_id:
        return None
    session = _active_sessions.get(session_id)
    return session["email"] if session else None

def is_session_active(session_id: str) -> bool:
    return session_id in _active_sessions

def list_active_sessions() -> list[dict]:
    return [
        {
            "sessionId": sid,
            "email": data["email"],
            "startedAt": data["startedAt"].isoformat().replace("+00:00", "Z"),
            "lastSeen": data["lastSeen"].isoformat().replace("+00:00", "Z"),
        }
        for sid, data in _active_sessions.items()
    ]
