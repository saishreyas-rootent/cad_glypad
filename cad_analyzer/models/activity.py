from datetime import datetime, timezone
from typing import Any, Literal
from pydantic import BaseModel, Field

class ActivityEvent(BaseModel):
    action: str
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"))
    sessionId: str | None = None
    ipAddress: str | None = None
    userAgent: str | None = None
    workflow: str | None = None
    status: str | None = None
    fileName: str | None = None
    fileType: str | None = None
    fileSize: int | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    def to_mongo(self) -> dict[str, Any]:
        return {k: v for k, v in self.model_dump().items() if v is not None}

class ActivityEventFactory:
    @staticmethod
    def login(session_id: str, ip_address: str | None, user_agent: str | None) -> ActivityEvent:
        return ActivityEvent(
            action="LOGIN",
            sessionId=session_id,
            ipAddress=ip_address,
            userAgent=user_agent
        )

    @staticmethod
    def logout(session_id: str) -> ActivityEvent:
        return ActivityEvent(
            action="LOGOUT",
            sessionId=session_id
        )

    @staticmethod
    def file_upload(session_id: str | None, file_name: str, file_type: str, file_size: int, workflow: str | None = None, status: str | None = None, metadata: dict | None = None) -> ActivityEvent:
        return ActivityEvent(
            action="FILE_UPLOAD",
            sessionId=session_id,
            fileName=file_name,
            fileType=file_type,
            fileSize=file_size,
            workflow=workflow,
            status=status,
            metadata=metadata or {}
        )

    @staticmethod
    def qc_analysis(session_id: str | None, status: str, metadata: dict | None = None) -> ActivityEvent:
        action = f"QC_ANALYSIS_{status.upper()}"
        return ActivityEvent(
            action=action,
            sessionId=session_id,
            workflow="QC",
            status=status,
            metadata=metadata or {}
        )

    @staticmethod
    def comparison(session_id: str | None, status: str, metadata: dict | None = None) -> ActivityEvent:
        action = f"COMPARISON_{status.upper()}"
        return ActivityEvent(
            action=action,
            sessionId=session_id,
            workflow="COMPARISON",
            status=status,
            metadata=metadata or {}
        )

    @staticmethod
    def workflow_selected(workflow: str, session_id: str | None) -> ActivityEvent:
        action = f"{workflow.upper()}_WORKFLOW_SELECTED"
        return ActivityEvent(
            action=action,
            workflow=workflow,
            sessionId=session_id
        )
