from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Query

from cad_analyzer.db.mongodb import (
    get_activity_logs_collection,
    get_users_collection,
)
from cad_analyzer.routers.common import database_unavailable_error
from cad_analyzer.services.serialization import envelope


router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/overview")
async def overview():
    try:
        pipeline = [
            {"$group": {
                "_id": None,
                "totalUsers": {"$sum": 1},
                "totalQcChecks": {"$sum": "$totalQcChecks"},
                "totalComparisons": {"$sum": "$totalComparisons"},
                "totalSessions": {"$sum": "$totalSessions"},
                "totalTimeSpentMinutes": {"$sum": "$totalTimeSpentMinutes"},
            }},
        ]
        result = await get_users_collection().aggregate(pipeline).to_list(1)
        data = result[0] if result else {
            "totalUsers": 0,
            "totalQcChecks": 0,
            "totalComparisons": 0,
            "totalSessions": 0,
            "totalTimeSpentMinutes": 0,
        }
        data.pop("_id", None)
        total_users = data.get("totalUsers", 0)
        total_sessions = data.get("totalSessions", 0)
        data["activeUsers"] = await get_users_collection().count_documents({"lastActivity": {"$ne": None}})
        data["onlineUsers"] = await get_users_collection().count_documents({"status": "Online"})
        file_counts = await get_activity_logs_collection().aggregate([
            {"$unwind": "$activities"},
            {"$match": {"activities.action": "FILE_UPLOAD"}},
            {"$count": "total"},
        ]).to_list(1)
        data["totalFilesUploaded"] = file_counts[0]["total"] if file_counts else 0
        data["averageSessionDurationMinutes"] = (
            round(data.get("totalTimeSpentMinutes", 0) / total_sessions, 2)
            if total_sessions else 0
        )
        return envelope(data)
    except RuntimeError as exc:
        raise database_unavailable_error(exc)


@router.get("/trends")
async def trends(
    email: str | None = None,
    action: str | None = None,
    days: int = Query(30, ge=1, le=365),
):
    try:
        start = datetime.now(timezone.utc) - timedelta(days=days)
        match = {"activities.timestamp": {"$gte": start}}
        if email:
            match["userEmail"] = email.strip().lower()
        if action:
            match["activities.action"] = action
        pipeline = [
            {"$unwind": "$activities"},
            {"$match": match},
            {"$group": {
                "_id": {
                    "date": {"$dateToString": {"format": "%Y-%m-%d", "date": "$activities.timestamp"}},
                    "action": "$activities.action",
                },
                "count": {"$sum": 1},
            }},
            {"$sort": {"_id.date": 1}},
        ]
        rows = await get_activity_logs_collection().aggregate(pipeline).to_list(None)
        return envelope([
            {"date": row["_id"]["date"], "action": row["_id"]["action"], "count": row["count"]}
            for row in rows
        ])
    except RuntimeError as exc:
        raise database_unavailable_error(exc)


@router.get("/sessions")
async def session_durations(email: str | None = None, limit: int = Query(30, ge=1, le=200)):
    try:
        query = {"activities.action": {"$in": ["LOGOUT", "SESSION_END"]}}
        if email:
            query["userEmail"] = email.strip().lower()
        pipeline = [
            {"$unwind": "$activities"},
            {"$match": query},
            {"$sort": {"activities.timestamp": -1}},
            {"$limit": limit},
            {"$project": {
                "_id": 0,
                "email": "$userEmail",
                "loginTime": "$activities.timestamp",
                "durationMinutes": "$activities.metadata.sessionDurationMinutes",
            }},
        ]
        rows = await get_activity_logs_collection().aggregate(pipeline).to_list(None)
        for row in rows:
            if row.get("loginTime") is not None:
                row["loginTime"] = row["loginTime"].isoformat()
            row["durationMinutes"] = row.get("durationMinutes") or 0
        return envelope(rows)
    except RuntimeError as exc:
        raise database_unavailable_error(exc)
