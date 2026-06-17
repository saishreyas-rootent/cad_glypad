from fastapi import APIRouter, HTTPException, Query, status
from datetime import datetime, timezone

from cad_analyzer.db.mongodb import get_activity_logs_collection, get_users_collection
from cad_analyzer.routers.common import database_unavailable_error
from cad_analyzer.services.serialization import envelope, serialize_document


router = APIRouter(prefix="/users", tags=["Users"])


def _activity_timestamp(activity: dict):
    timestamp = activity.get("timestamp")
    if isinstance(timestamp, str):
        timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    if isinstance(timestamp, datetime) and timestamp.tzinfo is None:
        return timestamp.replace(tzinfo=timezone.utc)
    return timestamp


@router.get("")
async def list_users(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    search: str | None = None,
):
    try:
        query = {}
        if search:
            query["$or"] = [
                {"email": {"$regex": search, "$options": "i"}},
                {"name": {"$regex": search, "$options": "i"}},
            ]


        collection = get_users_collection()
        total = await collection.count_documents(query)
        cursor = collection.find(query).sort("lastActivity", -1).skip((page - 1) * limit).limit(limit)
        rows = []
        async for row in cursor:
            public_row = serialize_document(row)
            public_row.pop("password", None)
            public_row.pop("passwordHash", None)
            rows.append(public_row)
        return envelope(rows, {"page": page, "limit": limit, "total": total})
    except RuntimeError as exc:
        raise database_unavailable_error(exc)


@router.get("/me")
async def get_me(email: str = None):
    try:
        if not email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="email required")
        user = await get_users_collection().find_one({"email": email})
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        public_user = serialize_document(user)
        public_user.pop("password", None)
        public_user.pop("passwordHash", None)
        return envelope(public_user)
    except HTTPException:
        raise
    except RuntimeError as exc:
        raise database_unavailable_error(exc)


@router.get("/{email}")
async def get_user(email: str):
    try:
        normalized_email = email.strip().lower()
        user = await get_users_collection().find_one({"email": normalized_email})
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        data = serialize_document(user)
        data.pop("password", None)
        data.pop("passwordHash", None)
        
        recent_activities = []
        activity_log = await get_activity_logs_collection().find_one({"userEmail": normalized_email}) or {}
        activities = sorted(
            activity_log.get("activities", []),
            key=lambda item: _activity_timestamp(item) or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True,
        )
        for activity in activities[:10]:
            doc = serialize_document(activity)
            doc["email"] = normalized_email
            doc["userEmail"] = normalized_email
            doc["userId"] = normalized_email
            doc["activityType"] = doc.get("action")
            recent_activities.append(doc)
            
        data["recentActivities"] = recent_activities
        return envelope(data)
    except HTTPException:
        raise
    except RuntimeError as exc:
        raise database_unavailable_error(exc)
