from fastapi import APIRouter, HTTPException

from ..schemas.models import PermissionDecision
from ..services.client_manager import client_manager

router = APIRouter(prefix="/api")


@router.post("/permission/{task_id}/{request_id}")
async def resolve_permission(task_id: str, request_id: str, body: PermissionDecision):
    ok = client_manager.resolve_permission(task_id, request_id, body.decision, body.message)
    if not ok:
        raise HTTPException(status_code=404, detail="No pending permission request found")
    return {"status": "ok"}
