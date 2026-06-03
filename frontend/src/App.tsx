import { useEffect, useState } from "react";
import type { Task, Folder, ChatMessage } from "./types";
import { Sidebar } from "./components/Sidebar";
import { ChatPanel } from "./components/ChatPanel";
import { PlanPanel } from "./components/PlanPanel";
import { fetchFolders, fetchTasks, fetchSession, fetchMessages, checkActiveStream } from "./api";

function getParamsFromUrl(): { folderId: string | null; taskId: string | null } {
  const params = new URLSearchParams(window.location.search);
  return {
    folderId: params.get("folder"),
    taskId: params.get("task"),
  };
}

function setParamsInUrl(folderId: string | null, taskId: string | null) {
  const url = new URL(window.location.href);
  if (folderId) url.searchParams.set("folder", folderId);
  else url.searchParams.delete("folder");
  if (taskId) url.searchParams.set("task", taskId);
  else url.searchParams.delete("task");
  window.history.replaceState(null, "", url.toString());
}

export default function App() {
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<ChatMessage[]>([]);
  const [workingTaskIds, setWorkingTaskIds] = useState<Set<string>>(new Set());
  const [doneTaskIds, setDoneTaskIds] = useState<Set<string>>(new Set());
  const [planVisible, setPlanVisible] = useState(false);
  const [planRefreshKey, setPlanRefreshKey] = useState(0);
  const [planWidth, setPlanWidth] = useState(400);

  const handleFolderSelect = (folder: Folder) => {
    setParamsInUrl(folder.id, null);
    setSelectedFolder(folder);
  };

  const handleTaskSelect = async (task: Task) => {
    if (!selectedFolder || selectedFolder.id !== task.folder_id) {
      const folders = await fetchFolders();
      const folder = folders.find((f) => f.id === task.folder_id);
      if (folder) setSelectedFolder(folder);
    }

    setParamsInUrl(task.folder_id, task.id);
    setDoneTaskIds((prev) => { if (!prev.has(task.id)) return prev; const n = new Set(prev); n.delete(task.id); return n; });
    setSelectedTask(task);
    setPlanVisible(task.plan_paths.length > 0);
    const [existing, history] = await Promise.all([
      fetchSession(task.id).catch(() => null),
      fetchMessages(task.id).catch(() => []),
    ]);
    setSessionId(existing);
    setInitialMessages(history);
  };

  const handleStreamingChange = (taskId: string, streaming: boolean) => {
    if (streaming) {
      setWorkingTaskIds((prev) => { const n = new Set(prev); n.add(taskId); return n; });
      setDoneTaskIds((prev) => { if (!prev.has(taskId)) return prev; const n = new Set(prev); n.delete(taskId); return n; });
    } else {
      setWorkingTaskIds((prev) => { const n = new Set(prev); n.delete(taskId); return n; });
      setDoneTaskIds((prev) => { const n = new Set(prev); n.add(taskId); return n; });
    }
    if (!streaming) {
      setPlanRefreshKey((k) => k + 1);
      if (selectedTask) {
        fetchTasks().then((tasks) => {
          const updated = tasks.find((t) => t.id === selectedTask.id);
          if (updated && updated.plan_paths.length > selectedTask.plan_paths.length) {
            setSelectedTask(updated);
            setPlanVisible(true);
          }
        });
      }
    }
  };

  // Poll background tasks' active stream status (skip current task, tracked by ChatPanel)
  useEffect(() => {
    const bgIds = [...workingTaskIds].filter((id) => id !== selectedTask?.id);
    if (bgIds.length === 0) return;
    const timer = setInterval(() => {
      bgIds.forEach((id) => {
        checkActiveStream(id).then((res) => {
          if (!res.active) {
            setWorkingTaskIds((prev) => {
              if (!prev.has(id)) return prev;
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
            setDoneTaskIds((prev) => { const n = new Set(prev); n.add(id); return n; });
          }
        });
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [workingTaskIds, selectedTask?.id]);

  useEffect(() => {
    const { folderId, taskId } = getParamsFromUrl();
    if (!folderId && !taskId) return;

    Promise.all([fetchFolders(), fetchTasks()]).then(([folders, tasks]) => {
      if (folderId) {
        const folder = folders.find((f) => f.id === folderId);
        if (folder) setSelectedFolder(folder);
      }
      if (taskId) {
        const task = tasks.find((t) => t.id === taskId);
        if (task) {
          if (!folderId) {
            const folder = folders.find((f) => f.id === task.folder_id);
            if (folder) setSelectedFolder(folder);
          }
          setSelectedTask(task);
          setPlanVisible(task.plan_paths.length > 0);
          Promise.all([
            fetchSession(task.id).catch(() => null),
            fetchMessages(task.id).catch(() => []),
          ]).then(([existing, history]) => {
            setSessionId(existing);
            setInitialMessages(history);
          });
        }
      }
    });
  }, []);

  return (
    <div className="flex h-screen font-sans">
      <div className="w-[280px] border-r border-border overflow-auto bg-muted/50 shrink-0">
        <Sidebar
          selectedFolderId={selectedFolder?.id ?? null}
          selectedTaskId={selectedTask?.id ?? null}
          workingTaskIds={workingTaskIds}
          doneTaskIds={doneTaskIds}
          onSelectFolder={handleFolderSelect}
          onSelectTask={handleTaskSelect}
        />
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {selectedTask ? (
          <div className="flex-1 flex min-h-0">
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <ChatPanel
                taskId={selectedTask.id}
                sessionId={sessionId}
                initialMessages={initialMessages}
                onSessionIdChange={setSessionId}
                onStreamingChange={(streaming) => handleStreamingChange(selectedTask.id, streaming)}
                planVisible={planVisible}
                onTogglePlan={() => setPlanVisible(!planVisible)}
                hasPlan={selectedTask.plan_paths.length > 0}
              />
            </div>
            {planVisible && (
              <div
                className="w-1 cursor-col-resize bg-border shrink-0 transition-colors hover:bg-primary"
                onMouseDown={(e) => {
                  e.preventDefault();
                  const startX = e.clientX;
                  const startWidth = planWidth;
                  const onMove = (ev: MouseEvent) => {
                    const delta = startX - ev.clientX;
                    setPlanWidth(Math.max(250, Math.min(800, startWidth + delta)));
                  };
                  const onUp = () => {
                    document.removeEventListener("mousemove", onMove);
                    document.removeEventListener("mouseup", onUp);
                  };
                  document.addEventListener("mousemove", onMove);
                  document.addEventListener("mouseup", onUp);
                }}
              />
            )}
            <PlanPanel
              planPaths={selectedTask.plan_paths}
              folderPath={selectedFolder?.folder_path ?? null}
              visible={planVisible}
              onClose={() => setPlanVisible(false)}
              refreshKey={planRefreshKey}
              width={planWidth}
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            选择一个任务开始对话
          </div>
        )}
      </div>
    </div>
  );
}
