from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class FolderORM(Base):
    __tablename__ = "folders"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    folder_path: Mapped[str] = mapped_column(String, nullable=False)

    tasks: Mapped[list["TaskORM"]] = relationship(
        "TaskORM", back_populates="folder", cascade="all, delete-orphan"
    )


class TaskORM(Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    folder_id: Mapped[str] = mapped_column(
        String, ForeignKey("folders.id", ondelete="CASCADE"), nullable=False
    )
    summary: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)

    folder: Mapped["FolderORM"] = relationship("FolderORM", back_populates="tasks")
    session: Mapped["SessionORM | None"] = relationship(
        "SessionORM", back_populates="task", cascade="all, delete-orphan", uselist=False
    )


class SessionORM(Base):
    __tablename__ = "sessions"

    task_id: Mapped[str] = mapped_column(
        String, ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True
    )
    session_id: Mapped[str] = mapped_column(String, nullable=False)

    task: Mapped["TaskORM"] = relationship("TaskORM", back_populates="session")
