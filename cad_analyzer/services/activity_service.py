import logging
from cad_analyzer.db.mongodb import append_activity, get_users_collection
from cad_analyzer.models.activity import ActivityEvent, ActivityEventFactory

logger = logging.getLogger(__name__)

async def _update_counters(email: str, event: ActivityEvent):
    updates = {}
    if event.action == "QC_ANALYSIS_COMPLETED":
        updates["$inc"] = {"totalQcChecks": 1}
    elif event.action == "COMPARISON_COMPLETED":
        updates["$inc"] = {"totalComparisons": 1}
        
    if updates:
        await get_users_collection().update_one(
            {"email": email.strip().lower()},
            updates
        )

async def log_activity(email: str, event: ActivityEvent) -> None:
    try:
        await append_activity(email, event.to_mongo())
        await _update_counters(email, event)
    except Exception:
        logger.exception("Failed to log activity")

# Convenience wrappers
async def log_file_upload(email: str, *, session_id: str | None, file_name: str, file_type: str, file_size: int, workflow: str | None = None, status: str | None = None, metadata: dict | None = None):
    event = ActivityEventFactory.file_upload(session_id, file_name, file_type, file_size, workflow, status, metadata)
    await log_activity(email, event)

async def log_qc_analysis(email: str, *, session_id: str | None, status: str, metadata: dict | None = None):
    event = ActivityEventFactory.qc_analysis(session_id, status, metadata)
    await log_activity(email, event)

async def log_comparison(email: str, *, session_id: str | None, status: str, metadata: dict | None = None):
    event = ActivityEventFactory.comparison(session_id, status, metadata)
    await log_activity(email, event)

async def log_workflow_selected(email: str, workflow: str, session_id: str | None = None):
    event = ActivityEventFactory.workflow_selected(workflow, session_id)
    await log_activity(email, event)
