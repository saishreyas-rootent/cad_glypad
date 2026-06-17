"""Debug MongoDB connection - show which URI is being used."""

import os
from dotenv import load_dotenv

# Load environment
load_dotenv()

# Check what's in .env
print("=== ENVIRONMENT VARIABLES ===")
print(f"MONGODB_URI from .env: {os.getenv('MONGODB_URI')}")
print(f"MONGODB_DB: {os.getenv('MONGODB_DB')}")

# Check what config is using
from cad_analyzer.config import settings

print("\n=== CONFIG SETTINGS ===")
print(f"settings.mongodb_uri: {settings.mongodb_uri}")
print(f"settings.mongodb_db: {settings.mongodb_db}")

# Determine if it's cloud or local
if "mongodb+srv" in settings.mongodb_uri:
    print("\n✓ Using CLOUD MongoDB Atlas")
elif "localhost" in settings.mongodb_uri or "127.0.0.1" in settings.mongodb_uri:
    print("\n✗ Using LOCAL MongoDB")
else:
    print(f"\n? Using: {settings.mongodb_uri}")
