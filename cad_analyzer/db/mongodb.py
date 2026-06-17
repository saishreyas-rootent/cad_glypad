import logging
from datetime import datetime, timezone
from pymongo import ASCENDING, IndexModel

from cad_analyzer.config import settings

logger = logging.getLogger(__name__)

try:
    from motor.motor_asyncio import AsyncIOMotorClient
except ImportError:
    AsyncIOMotorClient = None

client = None

def is_configured() -> bool:
    return bool(settings.mongodb_uri)

def get_database():
    if client is None:
        raise RuntimeError("MongoDB is not connected. Set MONGODB_URI and restart the API.")
    return client[settings.mongodb_db]

def get_users_collection():
    return get_database()["users"]

def get_activity_logs_collection():
    return get_database()["activityLogs"]

async def append_activity(user_email: str, activity: dict) -> None:
    """Always uses $push — never overwrites existing entries."""
    user_email = user_email.strip().lower()
    activity.setdefault("metadata", {})
    if "timestamp" not in activity:
        activity["timestamp"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    await get_activity_logs_collection().update_one(
        {"userEmail": user_email},
        {"$setOnInsert": {"userEmail": user_email}, "$push": {"activities": activity}},
        upsert=True,
    )

async def _ensure_indexes() -> None:
    db = get_database()
    try:
        # users
        await db["users"].create_indexes([
            IndexModel([("email", ASCENDING)], unique=True),
            IndexModel([("lastActivity", ASCENDING)]),
        ])

        # activityLogs — one doc per user
        await db["activityLogs"].create_indexes([
            IndexModel([("userEmail", ASCENDING)], unique=True),
            IndexModel([("activities.timestamp", ASCENDING)]),
            IndexModel([("activities.action", ASCENDING)]),
        ])
        logger.info("MongoDB indexes ensured.")
    except Exception as exc:
        logger.warning(f"Could not create indexes: {exc}")

async def _migrate_legacy_collections() -> None:
    db = get_database()
    collection_names = set(await db.list_collection_names())
    
    # We drop these as the migration logic is now placed in the migration script explicitly as per Phase 8
    # "Add `_migrate_legacy_collections()` — called once at startup ... See the provided mongodb.py deliverable for the full implementation."
    # The plan says to drop `sessions`, `uploadedFiles`, `activityEvents`, `userSessions`, `fileUploads`.
    # Wait, the plan also says the migration script `scripts/migrate_to_two_collections.py` does the actual migration. 
    # But it also says `_migrate_legacy_collections()` must "Read sessions -> emit LOGIN ...". This is a bit conflicting.
    # To be safe, I'll put a basic check here or just let the migration script do the heavy lifting, 
    # but the instructions literally say:
    # "The function must: Read sessions -> emit LOGIN + LOGOUT... Read uploadedFiles -> emit FILE_UPLOAD ... Drop sessions... Be idempotent"
    
    # We will implement it fully here as requested.
    def first_present(doc: dict, *keys: str):
        for k in keys:
            if doc.get(k) is not None:
                return doc[k]
        return None

    def normalize_email(doc: dict) -> str | None:
        val = first_present(doc, "userEmail", "email", "userId", "user_id")
        return val.strip().lower() if isinstance(val, str) and val.strip() else None

    # Migrate uploaded files
    for name in ("uploadedFiles", "uploaded_files", "fileUploads"):
        if name in collection_names:
            logger.info(f"Migrating {name} collection...")
            async for row in db[name].find({}):
                user_email = normalize_email(row)
                if not user_email:
                    continue
                metadata = row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
                timestamp = first_present(row, "timestamp", "createdAt", "uploadTime", "updatedAt")
                
                activity = {
                    "action": "FILE_UPLOAD",
                    "timestamp": timestamp,
                    "metadata": metadata,
                }
                
                for key in ["sessionId", "workflow", "fileDetails", "fileName", "fileType", "fileSize", "status", "ipAddress", "userAgent"]:
                    val = row.get(key, metadata.get(key))
                    if val is not None:
                        activity[key] = val
                        
                await append_activity(user_email, activity)
            await db[name].drop()
            logger.info(f"Dropped {name} collection.")

    # Migrate sessions
    for name in ("sessions", "userSessions"):
        if name in collection_names:
            logger.info(f"Migrating {name} collection...")
            async for row in db[name].find({}):
                user_email = normalize_email(row)
                if not user_email:
                    continue
                    
                metadata = row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
                session_id = first_present(row, "sessionId", "_id")
                
                base_event = {
                    "sessionId": str(session_id) if session_id else None,
                    "ipAddress": row.get("ipAddress") or metadata.get("ipAddress"),
                    "userAgent": row.get("userAgent") or metadata.get("userAgent"),
                    "metadata": metadata,
                }
                
                login_time = first_present(row, "loginTime", "startedAt", "createdAt")
                if login_time:
                    await append_activity(user_email, {**base_event, "action": "LOGIN", "timestamp": login_time})
                    
                logout_time = first_present(row, "logoutTime", "endedAt")
                if logout_time:
                    duration = first_present(row, "sessionDurationMinutes", "durationMinutes")
                    logout_event = {**base_event, "action": "LOGOUT", "timestamp": logout_time}
                    if duration is not None:
                        logout_event["metadata"] = {**metadata, "sessionDurationMinutes": duration}
                    await append_activity(user_email, logout_event)
            await db[name].drop()
            logger.info(f"Dropped {name} collection.")
            
    # Also drop other legacy ones
    if "activity_logs" in collection_names:
        # We assume _normalize_current_activity_logs handles it, or we just rely on `activityLogs` (camelCase) going forward.
        # This was part of older code, but plan just mentions `activityEvents`.
        if "activityEvents" in collection_names:
            await db["activityEvents"].drop()

async def connect_to_mongo():
    global client
    if not settings.mongodb_uri:
        logger.warning("MONGODB_URI not configured, running in offline mode")
        return
    if AsyncIOMotorClient is None:
        raise RuntimeError("motor is required when MONGODB_URI is configured")

    try:
        client = AsyncIOMotorClient(settings.mongodb_uri, serverSelectionTimeoutMS=5000)
        await client.admin.command("ping")
        logger.info(f"Connected to MongoDB: {settings.mongodb_db}")

        await _ensure_indexes()
        await _migrate_legacy_collections()
        
    except Exception as exc:
        logger.error(f"MongoDB Connection Error: {exc}")
        raise

async def close_mongo_connection():
    global client
    if client is not None:
        client.close()
        client = None
