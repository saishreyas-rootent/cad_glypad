from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel

from cad_analyzer.db.mongodb import get_users_collection
from cad_analyzer.routers.common import database_unavailable_error
from cad_analyzer.services.serialization import envelope, serialize_document
from cad_analyzer.services.session_service import close_session, create_session

router = APIRouter(prefix="/auth", tags=["Auth"])

class LoginRequest(BaseModel):
    email: str
    password: str

class LogoutRequest(BaseModel):
    email: str | None = None
    sessionId: str | None = None

@router.post("/login")
async def login(payload: LoginRequest, request: Request, response: Response):
    try:
        email = payload.email.strip().lower()
        user = await get_users_collection().find_one({"email": email})
        if not user or payload.password != user.get("password"):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

        session_id = await create_session(
            email,
            request.client.host if request.client else None,
            request.headers.get("user-agent"),
        )
        response.set_cookie(key="session_id", value=session_id, httponly=True)
        public_user = serialize_document(user)
        public_user.pop("password", None)
        public_user.pop("passwordHash", None)
        return envelope({"sessionId": session_id, "user": public_user})
    except HTTPException:
        raise
    except RuntimeError as exc:
        raise database_unavailable_error(exc)

@router.post("/logout")
async def logout(payload: LogoutRequest, request: Request, response: Response):
    try:
        session_id = request.cookies.get("session_id") or payload.sessionId
        if session_id:
            await close_session(session_id, reason="Logout")
        response.delete_cookie(key="session_id")
        return envelope({"durationMinutes": 0, "message": "Logged out successfully"})
    except HTTPException:
        raise
    except RuntimeError as exc:
        raise database_unavailable_error(exc)

@router.get("/me")
async def me(email: str = None):
    try:
        if not email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="email required")
        user = await get_users_collection().find_one({"email": email.strip().lower()})
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        public_user = serialize_document(user)
        public_user.pop("password", None)
        public_user.pop("passwordHash", None)
        return envelope(public_user)
    except HTTPException:
        raise
    except RuntimeError as exc:
        raise database_unavailable_error(exc)
