"""One-time migration: remove the 'status' field from all user documents."""

import asyncio
import sys

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from cad_analyzer.db.mongodb import close_mongo_connection, connect_to_mongo, get_users_collection


async def migrate():
    await connect_to_mongo()
    users = get_users_collection()
    result = await users.update_many({}, {"$unset": {"status": ""}})
    print(f"✓ Removed 'status' field from {result.modified_count} user document(s).")
    await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(migrate())
