"""Seed MongoDB with user accounts only. No dummy sessions or activity logs."""

import asyncio
import logging
import sys
from datetime import datetime, timezone

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

try:
    from dotenv import load_dotenv
    load_dotenv()
    logger.info("Loaded .env file successfully")
except ImportError:
    logger.warning("dotenv not installed, skipping .env loading")
except Exception as e:
    logger.error(f"Error loading .env file: {e}")

try:
    from cad_analyzer.db.mongodb import (
        close_mongo_connection,
        connect_to_mongo,
        get_activity_logs_collection,
        get_users_collection,
    )
    logger.info("Imported MongoDB utilities successfully")
except Exception as e:
    logger.error(f"Error importing utilities: {e}", exc_info=True)
    sys.exit(1)


SEED_USERS = [
    ("user1@test.com", "User One", "User@1231", "user"),
    ("user2@test.com", "User Two", "User@1232", "user"),
    ("user3@test.com", "User Three", "User@1233", "user"),
    ("user4@test.com", "User Four", "User@1234", "user"),
    ("user5@test.com", "User Five", "User@1235", "user"),
    ("user6@test.com", "User Six", "User@1236", "user"),
    ("user7@test.com", "User Seven", "User@1237", "user"),
    ("user8@test.com", "User Eight", "User@1238", "user"),
    ("user9@test.com", "User Nine", "User@1239", "user"),
    ("user10@test.com", "User Ten", "User@1240", "user"),
    ("admin@gmail.com", "Admin User", "admin123", "admin"),
]


async def seed():
    try:
        logger.info("Starting MongoDB seeding process...")
        await connect_to_mongo()
        logger.info("Connected to MongoDB successfully")

        users = get_users_collection()
        activity_logs = get_activity_logs_collection()
        logger.info("Retrieved collection references")

        # Delete existing seed users
        logger.info("Deleting existing seed users...")
        email_list = [email for email, _, _, _ in SEED_USERS]
        await users.delete_many({"email": {"$in": [*email_list, "user11@test.com"]}})
        await activity_logs.delete_many({"userEmail": {"$in": [*email_list, "user11@test.com"]}})
        logger.info(f"Deleted existing data for {len(email_list)} seed users and legacy extras")

        # Insert users only (no dummy sessions or activity logs)
        logger.info("Inserting seed users...")
        for email, name, password, role in SEED_USERS:
            try:
                await users.insert_one({
                    "email": email,
                    "name": name,
                    "role": role,
                    "password": password,
                    "status": "Offline",
                    "totalQcChecks": 0,
                    "totalComparisons": 0,
                    "totalSessions": 0,
                    "totalTimeSpentMinutes": 0,
                    "lastLogin": None,
                    "lastActivity": None,
                    "createdAt": datetime.now(timezone.utc),
                })
                await activity_logs.update_one(
                    {"userEmail": email},
                    {"$setOnInsert": {"userEmail": email, "activities": []}},
                    upsert=True,
                )
                logger.info(f"Seeded user: {email} (role: {role})")
            except Exception as e:
                logger.error(f"Error seeding user {email}: {e}", exc_info=True)

        await close_mongo_connection()
        logger.info("Closed MongoDB connection")
        logger.info(f"SUCCESS: Seeded {len(SEED_USERS)} users with their respective passwords.")

    except Exception as e:
        logger.error(f"FATAL ERROR during seeding: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    try:
        asyncio.run(seed())
    except KeyboardInterrupt:
        logger.warning("Seeding interrupted by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Unhandled error: {e}", exc_info=True)
        sys.exit(1)
