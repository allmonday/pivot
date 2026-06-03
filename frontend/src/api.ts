import type { Folder, FolderCreate, Task, TaskCreate, TaskUpdate, ChatMessage, PlanFile, ImageAttachment } from "./types";

const BASE = "http://localhost:8000/api";

// Folder APIs

export async function fetchFolders(): Promise<Folder[]> {
  const res = await fetch(`${BASE}/folders`);
  return res.json();
}

export async function createFolder(data: FolderCreate): Promise<Folder> {
  const res = await fetch(`${BASE}/folders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteFolder(folderId: string): Promise<void> {
  const res = await fetch(`${BASE}/folders/${folderId}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) throw new Error(await res.text());
}

// Task APIs

export async function fetchTasks(folderId?: string): Promise<Task[]> {
  const params = folderId ? `?folder_id=${encodeURIComponent(folderId)}` : "";
  const res = await fetch(`${BASE}/tasks${params}`);
  return res.json();
}

export async function createTask(data: TaskCreate): Promise<Task> {
  const res = await fetch(`${BASE}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateTask(taskId: string, data: TaskUpdate): Promise<Task> {
  const res = await fetch(`${BASE}/tasks/${taskId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteTask(taskId: string): Promise<void> {
  const res = await fetch(`${BASE}/tasks/${taskId}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) throw new Error(await res.text());
}

// Session APIs

export async function fetchSession(taskId: string): Promise<string | null> {
  const res = await fetch(`${BASE}/sessions/${taskId}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.session_id ?? null;
}

export async function fetchMessages(taskId: string): Promise<ChatMessage[]> {
  const res = await fetch(`${BASE}/messages/${taskId}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data as ChatMessage[]).map((msg) => ({
    ...msg,
    content: msg.content.filter((b) => b.kind !== "thinking"),
  }));
}

export async function fetchFullHistory(taskId: string): Promise<ChatMessage[]> {
  const res = await fetch(`${BASE}/full-history/${taskId}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data as ChatMessage[]).map((msg) => ({
    ...msg,
    content: msg.content.filter((b) => b.kind !== "thinking"),
  }));
}

// File APIs (used by FolderPicker)

export async function fetchFiles(path: string): Promise<import("./types").FileInfo[]> {
  const res = await fetch(`${BASE}/files?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchFileContent(path: string): Promise<string> {
  const res = await fetch(`${BASE}/files/content?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.content;
}

export async function fetchPlanFiles(folderPath: string): Promise<PlanFile[]> {
  const res = await fetch(`${BASE}/files/plans?folder_path=${encodeURIComponent(folderPath)}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// SSE stream helper

function consumeSSE(
  url: string,
  onEvent: (eventType: string, data: Record<string, unknown>) => void,
  onError: (err: Error) => void,
  onDone: () => void
): AbortController {
  const controller = new AbortController();

  fetch(url, { signal: controller.signal })
    .then(async (res) => {
      if (!res.ok) {
        onError(new Error(`HTTP ${res.status}: ${await res.text()}`));
        return;
      }
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        buffer = buffer.replace(/\r\n/g, "\n");

        const parts = buffer.split("\n\n");
        buffer = parts.pop()!;

        for (const part of parts) {
          const parsed = parseSSEPart(part);
          if (parsed) onEvent(parsed.eventType, parsed.data);
        }
      }

      // 处理剩余 buffer
      if (buffer.trim()) {
        const parsed = parseSSEPart(buffer.replace(/\r\n/g, "\n"));
        if (parsed) onEvent(parsed.eventType, parsed.data);
      }
      onDone();
    })
    .catch((err) => {
      if (err.name !== "AbortError") onError(err);
    });

  return controller;
}

function parseSSEPart(part: string): { eventType: string; data: Record<string, unknown> } | null {
  const lines = part.split("\n");
  let eventType = "";
  let data = "";
  for (const line of lines) {
    if (line.startsWith("event: ")) eventType = line.slice(7);
    if (line.startsWith("data: ")) data = line.slice(6);
  }
  if (eventType && data) {
    return { eventType, data: JSON.parse(data) };
  }
  return null;
}

// Chat streaming (POST to start, then GET SSE by task_id)

export function sendChat(
  taskId: string,
  message: string,
  _sessionId: string | null,
  mode: string = "code",
  onEvent: (eventType: string, data: Record<string, unknown>) => void,
  onError: (err: Error) => void,
  onDone: () => void,
  images?: ImageAttachment[],
): AbortController {
  const controller = new AbortController();
  let sseController: AbortController | null = null;

  controller.signal.addEventListener("abort", () => sseController?.abort());

  fetch(`${BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      task_id: taskId,
      message,
      mode,
      images: images?.map((img) => ({
        media_type: img.mediaType,
        data: img.base64,
        name: img.name,
      })) ?? [],
    }),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        const text = await res.text();
        if (res.status === 409) {
          onError(new Error("A stream is already active for this task"));
        } else {
          onError(new Error(text));
        }
        return;
      }
      // 连接 SSE 流，直接用 task_id
      sseController = consumeSSE(`${BASE}/stream/${taskId}`, onEvent, onError, onDone);
    })
    .catch((err) => {
      if (err.name !== "AbortError") onError(err);
    });

  return controller;
}

// 重连已有的 stream（按 task_id）
export function reconnectStream(
  taskId: string,
  onEvent: (eventType: string, data: Record<string, unknown>) => void,
  onError: (err: Error) => void,
  onDone: () => void
): AbortController {
  return consumeSSE(`${BASE}/stream/${taskId}`, onEvent, onError, onDone);
}

// 检查活跃 stream
export async function checkActiveStream(taskId: string): Promise<{ active: boolean }> {
  const res = await fetch(`${BASE}/active-stream/${taskId}`);
  if (!res.ok) return { active: false };
  return res.json();
}

// 中断活跃 stream
export async function interruptStream(taskId: string): Promise<void> {
  await fetch(`${BASE}/interrupt/${taskId}`, { method: "POST" });
}

// 权限审批
export async function resolvePermission(
  taskId: string,
  requestId: string,
  decision: "allow" | "deny",
  message: string = ""
): Promise<void> {
  const res = await fetch(
    `${BASE}/permission/${taskId}/${requestId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, message }),
    }
  );
  if (!res.ok) throw new Error(await res.text());
}
