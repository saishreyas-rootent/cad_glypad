"""One-time migration: remove all dummy activity logs,
and reset user counters to zero so only real-time data is tracked."""

import asyncio
import sys

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from cad_analyzer.db.mongodb import (
    close_mongo_connection,
    connect_to_mongo,
    get_activity_logs_collection,
    get_users_collection,
)


async def migrate():
    await connect_to_mongo()

    activities = get_activity_logs_collection()
    users = get_users_collection()

    # 1. Drop ALL activity logs
    activity_result = await activities.delete_many({})
    print(f"Deleted {activity_result.deleted_count} activity log(s).")

    # 2. Reset counters on every user to zero
    reset_result = await users.update_many({}, {"$set": {
        "totalQcChecks": 0,
        "totalComparisons": 0,
        "totalSessions": 0,
        "totalTimeSpentMinutes": 0,
        "lastLogin": None,
        "lastActivity": None,
    }})
    print(f"Reset counters for {reset_result.modified_count} user(s).")

    cursor = users.find({}, {"email": 1})
    created = 0
    async for user in cursor:
        email = user.get("email")
        if not email:
            continue
        await activities.update_one(
            {"userEmail": email.strip().lower()},
            {"$setOnInsert": {"userEmail": email.strip().lower(), "activities": []}},
            upsert=True,
        )
        created += 1
    print(f"Ensured {created} empty activity log document(s).")

    await close_mongo_connection()
    print("Done. Only real-time data will be stored from now on.")


if __name__ == "__main__":
    asyncio.run(migrate())
