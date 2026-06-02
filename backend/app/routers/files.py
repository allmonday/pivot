from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ..schemas.models import FileInfo

router = APIRouter(prefix="/api")


@router.get("/files", response_model=list[FileInfo])
async def get_files(path: str = Query(...)):
    target = Path(path).resolve()
    if not target.is_dir():
        raise HTTPException(status_code=404, detail="Directory not found")

    result = []
    for entry in sorted(target.iterdir(), key=lambda e: (not e.is_dir(), e.name.lower())):
        if entry.name.startswith("."):
            continue
        result.append(
            FileInfo(
                name=entry.name,
                path=str(entry),
                is_dir=entry.is_dir(),
                size=entry.stat().st_size if entry.is_file() else 0,
            )
        )
    return result


class FileContentResponse(BaseModel):
    content: str


@router.get("/files/content", response_model=FileContentResponse)
async def get_file_content(path: str = Query(...)):
    target = Path(path).resolve()
    if not target.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    if target.stat().st_size > 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large")
    return FileContentResponse(content=target.read_text(encoding="utf-8"))


class PlanFile(BaseModel):
    name: str
    path: str
    modified_at: str


@router.get("/files/plans", response_model=list[PlanFile])
async def get_plan_files(folder_path: str = Query(...)):
    plans_dir = Path(folder_path).resolve() / ".claude" / "plans"
    if not plans_dir.is_dir():
        return []
    md_files = sorted(plans_dir.glob("*.md"), key=lambda p: p.stat().st_mtime, reverse=True)
    return [
        PlanFile(
            name=f.name,
            path=str(f),
            modified_at=fmt_mtime(f.stat().st_mtime),
        )
        for f in md_files
    ]


def fmt_mtime(ts: float) -> str:
    from datetime import datetime
    return datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M")
