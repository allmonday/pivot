import asyncio
import base64
import fcntl
import json
import logging
import os
import pty
import struct
import sys
import termios
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger("pivot.terminal")
router = APIRouter(prefix="/api")

_active_terminals: dict[str, "TerminalSession"] = {}

_SHELL = os.environ.get("SHELL", "/bin/bash")


def _cleanup_terminal(task_id: str) -> None:
    """Remove a terminal session from the active map."""
    _active_terminals.pop(task_id, None)


class TerminalSession:
    """Manages a single PTY child process for a task."""

    def __init__(self, task_id: str, cwd: str) -> None:
        self.task_id = task_id
        self.cwd = cwd
        self.master_fd: int | None = None
        self.pid: int | None = None
        self._subscribers: list[WebSocket] = []
        self._reader_task: asyncio.Task | None = None
        self._closed = False

    async def start(self) -> None:
        pid, fd = pty.fork()
        if pid == 0:
            # Child process
            try:
                os.chdir(self.cwd)
            except OSError:
                pass
            os.execvp(_SHELL, [_SHELL])
            sys.exit(1)

        # Parent process — fd stays blocking, reads happen in thread pool
        self.pid = pid
        self.master_fd = fd
        self._reader_task = asyncio.create_task(self._read_loop())
        logger.info("Terminal started for task=%s pid=%d cwd=%s", self.task_id, pid, self.cwd)

    async def _read_loop(self) -> None:
        loop = asyncio.get_event_loop()
        try:
            while not self._closed and self.master_fd is not None:
                data = await loop.run_in_executor(None, self._blocking_read)
                if data is None:
                    break
                encoded = base64.b64encode(data).decode("ascii")
                msg = json.dumps({"type": "output", "data": encoded})
                dead: list[WebSocket] = []
                for ws in self._subscribers:
                    try:
                        await ws.send_text(msg)
                    except Exception:
                        dead.append(ws)
                for ws in dead:
                    self._subscribers.remove(ws)
        except asyncio.CancelledError:
            pass
        except Exception:
            logger.exception("Read loop error for task=%s", self.task_id)
        finally:
            exit_msg = json.dumps({"type": "exit"})
            for ws in list(self._subscribers):
                try:
                    await ws.send_text(exit_msg)
                except Exception:
                    pass
            self._closed = True
            _cleanup_terminal(self.task_id)
            logger.info("Terminal closed for task=%s", self.task_id)

    def _blocking_read(self) -> bytes | None:
        try:
            data = os.read(self.master_fd, 65536)
            if not data:
                return None
            return data
        except OSError:
            return None

    async def write(self, data: str) -> None:
        if self.master_fd is None or self._closed:
            return
        loop = asyncio.get_event_loop()
        try:
            await loop.run_in_executor(None, lambda: os.write(self.master_fd, data.encode("utf-8")))  # type: ignore[arg-type]
        except OSError:
            pass

    async def resize(self, cols: int, rows: int) -> None:
        if self.master_fd is None or self._closed:
            return
        try:
            winsize = struct.pack("HHHH", rows, cols, 0, 0)
            fcntl.ioctl(self.master_fd, termios.TIOCSWINSZ, winsize)
        except OSError:
            pass

    def subscribe(self, ws: WebSocket) -> None:
        self._subscribers.append(ws)

    def unsubscribe(self, ws: WebSocket) -> None:
        if ws in self._subscribers:
            self._subscribers.remove(ws)

    async def close(self) -> None:
        self._closed = True
        if self._reader_task and not self._reader_task.done():
            self._reader_task.cancel()
        if self.master_fd is not None:
            try:
                os.close(self.master_fd)
            except OSError:
                pass
            self.master_fd = None
        if self.pid is not None:
            try:
                os.kill(self.pid, 9)
            except OSError:
                pass
            self.pid = None
        self._subscribers.clear()
        _cleanup_terminal(self.task_id)


async def shutdown_all_terminals() -> None:
    for session in list(_active_terminals.values()):
        await session.close()
    _active_terminals.clear()


@router.websocket("/ws/terminal/{task_id}")
async def terminal_ws(websocket: WebSocket, task_id: str) -> None:
    await websocket.accept()

    cwd = websocket.query_params.get("cwd", "/")

    # Validate cwd
    if not os.path.isdir(cwd):
        cwd = os.path.expanduser("~")

    # Get or create terminal session
    session = _active_terminals.get(task_id)
    if session is None or session._closed:
        session = TerminalSession(task_id, cwd)
        await session.start()
        _active_terminals[task_id] = session

    session.subscribe(websocket)

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data: dict[str, Any] = json.loads(raw)
            except json.JSONDecodeError:
                continue

            msg_type = data.get("type")
            if msg_type == "input":
                await session.write(data.get("data", ""))
            elif msg_type == "resize":
                cols = data.get("cols", 80)
                rows = data.get("rows", 24)
                await session.resize(int(cols), int(rows))
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("Terminal WebSocket error for task=%s", task_id)
    finally:
        session.unsubscribe(websocket)
