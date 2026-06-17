from datetime import datetime, timezone

from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    email: str
    name: str
    password: str
    role: str = "user"


class UserPublic(BaseModel):
    id: str | None = None
    email: str
    name: str
    role: str = "user"
    totalQcChecks: int = 0
    totalComparisons: int = 0
    totalSessions: int = 0
    totalTimeSpentMinutes: int = 0
    lastLogin: datetime | None = None
    lastActivity: datetime | None = None
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
