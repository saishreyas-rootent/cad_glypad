"""Dedicated endpoint that aggregates all analytics data for a single user."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, status

from cad_analyzer.db.mongodb import (
    get_activity_logs_collection,
    get_users_collection,
)
from cad_analyzer.routers.common import database_unavailable_error
from cad_analyzer.services.serialization import envelope, serialize_document


router = APIRouter(prefix="/users", tags=["User Analytics"])


def _activity_timestamp(activity: dict):
    timestamp = activity.get("timestamp")
    if isinstance(timestamp, str):
        timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    if isinstance(timestamp, datetime) and timestamp.tzinfo is None:
        return timestamp.replace(tzinfo=timezone.utc)
    return timestamp


@router.get("/{email}/analytics")
async def user_analytics(email: str):
    """Return profile, stats, sessions, activity logs, and 30-day trends."""
    try:
        normalized_email = email.strip().lower()
        user = await get_users_collection().find_one({"email": normalized_email})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        profile = serialize_document(user)
        profile.pop("password", None)
        profile.pop("passwordHash", None)

        stats = {
            "totalQcChecks": profile.get("totalQcChecks", 0),
            "totalComparisons": profile.get("totalComparisons", 0),
            "totalSessions": profile.get("totalSessions", 0),
            "totalTimeSpentMinutes": profile.get("totalTimeSpentMinutes", 0),
        }

        activity_log = await get_activity_logs_collection().find_one({"userEmail": normalized_email}) or {}
        user_activities = activity_log.get("activities", [])
        stats["uploadedFilesCount"] = sum(
            1 for activity in user_activities if activity.get("action") == "FILE_UPLOAD"
        )

        recent_activities = sorted(
            user_activities,
            key=lambda item: _activity_timestamp(item) or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True,
        )

        sessions = []
        for activity in (
            item for item in recent_activities if item.get("action") in {"LOGIN", "SESSION_START"}
        ):
            doc = serialize_document(activity)
            sessions.append({
                "sessionId": doc.get("sessionId") or doc.get("metadata", {}).get("sessionId"),
                "email": normalized_email,
                "loginTime": doc.get("timestamp"),
            })
            if len(sessions) == 50:
                break

        activities = []
        for activity in recent_activities[:100]:
            doc = serialize_document(activity)
            doc["email"] = normalized_email
            doc["userEmail"] = normalized_email
            doc["userId"] = normalized_email
            doc["activityType"] = doc.get("action")
            activities.append(doc)

        start = datetime.now(timezone.utc) - timedelta(days=30)
        trend_counts = {}
        for activity in user_activities:
            timestamp = _activity_timestamp(activity)
            if not timestamp or timestamp < start:
                continue
            key = (timestamp.strftime("%Y-%m-%d"), activity.get("action"))
            trend_counts[key] = trend_counts.get(key, 0) + 1
        trends = [
            {"date": date, "action": action, "count": count}
            for (date, action), count in sorted(trend_counts.items())
        ]

        return envelope(
            {
                "profile": profile,
                "stats": stats,
                "sessions": sessions,
                "activities": activities,
                "trends": trends,
            }
        )

    except HTTPException:
        raise
    except RuntimeError as exc:
        raise database_unavailable_error(exc)
