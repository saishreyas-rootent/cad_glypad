"""Runtime configuration for the CAD analyzer API."""

import os
from dataclasses import dataclass

# Load .env FIRST and OVERRIDE any system environment variables
try:
    from dotenv import load_dotenv
    load_dotenv(override=True)  # Force .env to override system variables
except ImportError:
    pass


@dataclass(frozen=True)
class Settings:
    mongodb_uri: str = os.getenv("MONGODB_URI", "")
    mongodb_db: str = os.getenv("MONGODB_DB", "glypad_db")


settings = Settings()
