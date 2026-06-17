from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel

from cad_analyzer.db.mongodb import get_activity_logs_collection, get_users_collection
from cad_analyzer.routers.common import database_unavailable_error
from cad_analyzer.services.activity_service import log_activity, log_file_upload, log_qc_analysis, log_comparison
from cad_analyzer.models.activity import ActivityEvent
from cad_analyzer.services.serialization import envelope, serialize_document


router = APIRouter(tags=["Activity"])


class ActivityPayload(BaseModel):
    email: str | None = None
    action: str | None = None
    sessionId: str | None = None
    metadata: dict | None = None


def _activity_matches(activity: dict, action: str | None = None, workflow: str | None = None) -> bool:
    if action and activity.get("action") != action:
        return False
    if workflow and activity.get("workflow") != workflow and activity.get("metadata", {}).get("workflow") != workflow:
        return False
    return True


async def _flatten_activities(
    email: str | None = None,
    action: str | None = None,
    workflow: str | None = None,
) -> list[dict]:
    query = {}
    if email:
        query["userEmail"] = email.strip().lower()

    rows = []
    cursor = get_activity_logs_collection().find(query)
    async for log in cursor:
        user_email = log.get("userEmail")
        for index, activity in enumerate(log.get("activities", [])):
            if not _activity_matches(activity, action, workflow):
                continue
            doc = serialize_document(activity)
            doc["id"] = f"{log.get('_id')}:{index}"
            doc["email"] = user_email
            doc["userEmail"] = user_email
            doc["userId"] = user_email
            doc["activityType"] = doc.get("action")
            rows.append(doc)
    return sorted(rows, key=lambda item: item.get("timestamp") or "", reverse=True)


@router.post("/activity/log")
async def create_activity(payload: ActivityPayload):
    try:
        if not payload.email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="email required")
        if not payload.action:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="action required")

        email = payload.email.strip().lower()
        metadata = payload.metadata or {}
        session_id = payload.sessionId

        if payload.action in {"QC_FILE_UPLOADED", "ORIGINAL_DRAWING_UPLOADED", "COMPARISON_DRAWING_UPLOADED"}:
            workflow = "QC" if payload.action == "QC_FILE_UPLOADED" else "Comparison"
            metadata["originalAction"] = payload.action
            await log_file_upload(
                email,
                session_id=session_id,
                file_name=metadata.get("fileName", "unknown"),
                file_type=metadata.get("fileType", "unknown"),
                file_size=metadata.get("fileSize", 0),
                workflow=workflow,
                status=metadata.get("status", "Uploaded"),
                metadata=metadata
            )
        else:
            event = ActivityEvent(action=payload.action, sessionId=session_id, metadata=metadata)
            await log_activity(email, event)

        return envelope({"message": "Activity logged"})
    except HTTPException:
        raise
    except RuntimeError as exc:
        raise database_unavailable_error(exc)


@router.post("/activity/qc")
async def create_qc_activity(payload: ActivityPayload | None = None, email: str = None):
    try:
        if not email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="email required")
        metadata = (payload or ActivityPayload()).metadata or {}
        await log_qc_analysis(email.strip().lower(), session_id=None, status="Completed", metadata=metadata)
        return envelope({"message": "QC Check logged"})
    except HTTPException:
        raise
    except RuntimeError as exc:
        raise database_unavailable_error(exc)


@router.post("/activity/comparison")
async def create_comparison_activity(payload: ActivityPayload | None = None, email: str = None):
    try:
        if not email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="email required")
        metadata = (payload or ActivityPayload()).metadata or {}
        await log_comparison(email.strip().lower(), session_id=None, status="Completed", metadata=metadata)
        return envelope({"message": "Comparison logged"})
    except HTTPException:
        raise
    except RuntimeError as exc:
        raise database_unavailable_error(exc)


@router.get("/activities")
async def list_activities(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    email: str | None = None,
    action: str | None = None,
):
    try:
        rows = await _flatten_activities(email=email, action=action)
        total = len(rows)
        rows = rows[(page - 1) * limit: page * limit]

        return envelope(rows, {"page": page, "limit": limit, "total": total})
    except RuntimeError as exc:
        raise database_unavailable_error(exc)


@router.get("/activities/{email}")
async def list_user_activities(
    email: str,
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
):
    try:
        rows = await _flatten_activities(email=email)
        total = len(rows)
        rows = rows[(page - 1) * limit: page * limit]
                
        return envelope(rows, {"page": page, "limit": limit, "total": total})
    except RuntimeError as exc:
        raise database_unavailable_error(exc)


@router.get("/uploaded-files")
async def list_uploaded_files(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    email: str | None = None,
    workflow: str | None = None,
):
    try:
        rows = await _flatten_activities(email=email, action="FILE_UPLOAD", workflow=workflow)
        total = len(rows)
        rows = rows[(page - 1) * limit: page * limit]
        file_rows = []
        for doc in rows:
            meta = doc.get("metadata", {})
            file_record = {
                "id": doc.get("id"),
                "email": doc.get("userEmail"),
                "workflow": doc.get("workflow") or meta.get("workflow"),
                "fileName": doc.get("fileName") or meta.get("fileName"),
                "fileType": doc.get("fileType") or meta.get("fileType"),
                "fileSize": doc.get("fileSize") or meta.get("fileSize"),
                "uploadTime": doc.get("timestamp"),
                "analysisStatus": doc.get("analysisStatus") or doc.get("status") or meta.get("analysisStatus", "Uploaded"),
                "metadata": meta,
            }
            if "originalDrawing" in meta:
                file_record["originalDrawing"] = meta["originalDrawing"]
            if "comparisonDrawing" in meta:
                file_record["comparisonDrawing"] = meta["comparisonDrawing"]
            file_rows.append(file_record)
            
        return envelope(file_rows, {"page": page, "limit": limit, "total": total})
    except RuntimeError as exc:
        raise database_unavailable_error(exc)
