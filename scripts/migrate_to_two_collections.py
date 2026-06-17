import asyncio
import logging
import os
import sys

# Ensure cad_analyzer is in path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from cad_analyzer.config import settings
from cad_analyzer.db.mongodb import connect_to_mongo, close_mongo_connection, get_database, _migrate_legacy_collections, _ensure_indexes

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
logger = logging.getLogger(__name__)

async def run_migration():
    dry_run = os.environ.get("DRY_RUN", "0") == "1"
    if dry_run:
        logger.info("Running in DRY_RUN mode. (No actual writes or drops will occur if implemented in dry run, but currently it just prints).")
        # To truly support dry-run safely, one should modify _migrate_legacy_collections to check DRY_RUN
        # We will just do a fast connect and warn.
    
    logger.info("Connecting to MongoDB...")
    await connect_to_mongo()
    
    logger.info("Starting migration of legacy collections...")
    db = get_database()
    initial_count = await db["activityLogs"].count_documents({})
    
    if not dry_run:
        await _ensure_indexes()
        await _migrate_legacy_collections()
        
    final_count = await db["activityLogs"].count_documents({})
    
    logger.info("Migration complete.")
    logger.info(f"activityLogs had {initial_count} documents before.")
    logger.info(f"activityLogs now has {final_count} user documents.")

    await close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(run_migration())
