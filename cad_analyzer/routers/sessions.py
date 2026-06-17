from fastapi import APIRouter, HTTPException, Request, status
from cad_analyzer.routers.common import database_unavailable_error
from cad_analyzer.services.serialization import envelope
from cad_analyzer.services.session_service import close_session, create_session, list_active_sessions


router = APIRouter(prefix="/session", tags=["Sessions"])


@router.post("/login")
async def session_login(request: Request, email: str = None):
    try:
        if not email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="email required")
        session_id = await create_session(
            email,
            request.client.host if request.client else None,
            request.headers.get("user-agent"),
        )
        return envelope({"sessionId": session_id})
    except HTTPException:
        raise
    except RuntimeError as exc:
        raise database_unavailable_error(exc)


@router.post("/logout")
async def session_logout(email: str = None, sessionId: str = None):
    try:
        if not email and not sessionId:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="email or sessionId required")
            
        if sessionId:
            await close_session(sessionId, "Logout")
        elif email:
            active_sids = [s["sessionId"] for s in list_active_sessions() if s["email"] == email.strip().lower()]
            for sid in active_sids:
                await close_session(sid, "Logout")

        return envelope({"message": "Logged out successfully"})
    except HTTPException:
        raise
    except RuntimeError as exc:
        raise database_unavailable_error(exc)
