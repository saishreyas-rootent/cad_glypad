from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from cad_analyzer.db.mongodb import get_users_collection, get_activity_logs_collection
from cad_analyzer.services.session_service import list_active_sessions
from cad_analyzer.services.serialization import envelope

router = APIRouter(prefix="/admin", tags=["Admin"])

@router.get("/users")
async def get_users(skip: int = 0, limit: int = 50):
    users_cursor = get_users_collection().find({}).sort("lastActivity", -1).skip(skip).limit(limit)
    users = await users_cursor.to_list(length=limit)
    for u in users:
        u["id"] = str(u.pop("_id"))
    total = await get_users_collection().count_documents({})
    return envelope(users, {"total": total})

@router.get("/users/{email}/activities")
async def get_user_activities(email: str, action: Optional[str] = None):
    doc = await get_activity_logs_collection().find_one({"userEmail": email.strip().lower()})
    if not doc:
        return envelope([])
    
    activities = doc.get("activities", [])
    if action:
        activities = [a for a in activities if a.get("type") == action or a.get("action") == action]
        
    for a in activities:
        if isinstance(a.get("timestamp"), datetime):
            a["timestamp"] = a["timestamp"].isoformat()
    
    # Sort newest first
    activities.sort(key=lambda x: x.get("timestamp") or "", reverse=True)
    return envelope(activities)

@router.get("/users/{email}/sessions")
async def get_user_sessions(email: str):
    doc = await get_activity_logs_collection().find_one({"userEmail": email.strip().lower()})
    if not doc:
        return envelope([])
    
    activities = doc.get("activities", [])
    for a in activities:
        if isinstance(a.get("timestamp"), datetime):
            a["timestamp"] = a["timestamp"].isoformat()
            
    activities.sort(key=lambda x: x.get("timestamp") or "")
    
    sessions = {}
    for a in activities:
        sid = a.get("sessionId") or a.get("metadata", {}).get("sessionId")
        if not sid:
            continue
        if sid not in sessions:
            sessions[sid] = {"sessionId": sid, "loginTime": None, "logoutTime": None, "status": "Closed", "ipAddress": a.get("ipAddress")}
        
        event_type = a.get("type") or a.get("action")
        if event_type == "LOGIN":
            sessions[sid]["loginTime"] = a.get("timestamp")
            sessions[sid]["ipAddress"] = a.get("ipAddress") or sessions[sid]["ipAddress"]
            sessions[sid]["status"] = "Active"
        elif event_type == "LOGOUT":
            sessions[sid]["logoutTime"] = a.get("timestamp")
            sessions[sid]["status"] = "Closed"
            sessions[sid]["sessionDurationMinutes"] = a.get("durationSeconds", 0) // 60 or a.get("metadata", {}).get("durationMinutes")
            
    # Mark as active if it is currently in active memory
    active_sids = {s["sessionId"] for s in list_active_sessions() if s["email"] == email.strip().lower()}
    for sid, s in sessions.items():
        if sid in active_sids:
            s["status"] = "Active"

    sorted_sessions = sorted(sessions.values(), key=lambda x: x["loginTime"] or "", reverse=True)
    return envelope(sorted_sessions)

@router.get("/users/{email}/trends")
async def get_user_trends(email: str, days: int = Query(30)):
    try:
        doc = await get_activity_logs_collection().find_one({"userEmail": email.strip().lower()})
        if not doc:
            return envelope([])
        
        activities = doc.get("activities", [])
        for a in activities:
            if isinstance(a.get("timestamp"), datetime):
                a["timestamp"] = a["timestamp"].isoformat()
                
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        cutoff_iso = cutoff.isoformat().replace("+00:00", "Z")
        
        trends_map = {}
        for a in activities:
            ts = a.get("timestamp") or ""
            if not ts or ts < cutoff_iso:
                continue
            date_key = ts[:10]
            action = a.get("type") or a.get("action")
            key = (date_key, action)
            trends_map[key] = trends_map.get(key, 0) + 1
            
        trends = [{"date": k[0], "action": k[1], "count": v} for k, v in trends_map.items()]
        return envelope(trends)
    except Exception as e:
        import traceback
        return {"error": str(e), "traceback": traceback.format_exc()}

@router.get("/active-sessions")
async def get_active_sessions():
    sessions = list_active_sessions()
    return envelope(sessions)
