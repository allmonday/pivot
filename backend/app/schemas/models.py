from pydantic import BaseModel, Field
from typing import Literal, Optional


class Folder(BaseModel):
    id: str
    name: str
    folder_path: str


class FolderCreate(BaseModel):
    name: str
    folder_path: str
    task_names: list[str] = []


class Task(BaseModel):
    id: str
    name: str
    folder_id: str
    plan_paths: list[str] = []


class TaskCreate(BaseModel):
    name: str
    folder_id: str


class TaskUpdate(BaseModel):
    name: Optional[str] = None


class FileInfo(BaseModel):
    name: str
    path: str
    is_dir: bool
    size: int


class ImageData(BaseModel):
    media_type: str
    data: str
    name: str = ""


class ChatRequest(BaseModel):
    task_id: str
    message: str
    session_id: Optional[str] = None
    mode: Literal["plan", "code"] = "code"
    images: list[ImageData] = Field(default_factory=list)


class PermissionDecision(BaseModel):
    decision: Literal["allow", "deny"]
    message: str = ""


class FileContentResponse(BaseModel):
    content: str


class PlanFile(BaseModel):
    name: str
    path: str
    modified_at: str
