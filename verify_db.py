"""Verify MongoDB data is actually saved."""

import asyncio
import logging
import os
from dotenv import load_dotenv

# Load environment
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

from cad_analyzer.db.mongodb import connect_to_mongo, close_mongo_connection, get_users_collection

async def verify():
    try:
        logger.info("Connecting to MongoDB...")
        await connect_to_mongo()
        logger.info("✓ Connected successfully")
        
        users = get_users_collection()
        logger.info("Getting collection references...")
        
        # Count users
        count = await users.count_documents({})
        logger.info(f"Total users in database: {count}")
        
        # List all users
        cursor = users.find({}, {"email": 1, "role": 1, "name": 1})
        all_users = await cursor.to_list(length=None)
        
        logger.info("\n=== USERS IN DATABASE ===")
        for user in all_users:
            logger.info(f"  • {user['email']} (role: {user.get('role', 'N/A')}, name: {user.get('name', 'N/A')})")
        
        if count == 0:
            logger.warning("⚠️ NO USERS FOUND - Data may not be persisting!")
            logger.warning("Check MongoDB Atlas settings:")
            logger.warning("  1. Verify IP Whitelist includes your current IP")
            logger.warning("  2. Check database name: glypad_db")
            logger.warning("  3. Check collection name: users")
            logger.warning("  4. Verify credentials in .env: MONGODB_URI")
        else:
            logger.info(f"✓ SUCCESS: Found {count} users in database!")
        
        await close_mongo_connection()
        
    except Exception as e:
        logger.error(f"ERROR: {e}", exc_info=True)

if __name__ == "__main__":
    asyncio.run(verify())
