import { useEffect, useState } from "react";
import type { Task, Folder, ChatMessage } from "./types";
import { Sidebar } from "./components/Sidebar";
import { ChatPanel } from "./components/ChatPanel";
import { PlanPanel } from "./components/PlanPanel";
import { fetchFolders, fetchTasks, fetchSession, fetchMessages } from "./api";

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
  const [working, setWorking] = useState(false);
  const [planVisible, setPlanVisible] = useState(false);
  const [planRefreshKey, setPlanRefreshKey] = useState(0);
  const [planWidth, setPlanWidth] = useState(400);

  const handleFolderSelect = (folder: Folder) => {
    setParamsInUrl(folder.id, null);
    setSelectedFolder(folder);
  };

  const handleTaskSelect = async (task: Task) => {
    // Ensure folder is set for this task
    if (!selectedFolder || selectedFolder.id !== task.folder_id) {
      const folders = await fetchFolders();
      const folder = folders.find((f) => f.id === task.folder_id);
      if (folder) setSelectedFolder(folder);
    }

    setParamsInUrl(task.folder_id, task.id);
    setWorking(false);
    setSelectedTask(task);
    setPlanVisible(task.plan_paths.length > 0);
    const [existing, history] = await Promise.all([
      fetchSession(task.id).catch(() => null),
      fetchMessages(task.id).catch(() => []),
    ]);
    setSessionId(existing);
    setInitialMessages(history);
  };

  const handleStreamingDone = (streaming: boolean) => {
    setWorking(streaming);
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

  // restore folder and task from URL on mount
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
    <div style={{ display: "flex", height: "100vh", fontFamily: "sans-serif" }}>
      {/* Left: Sidebar (Folders + Tasks) */}
      <div
        style={{
          width: 260,
          borderRight: "1px solid #e0e0e0",
          overflow: "auto",
          background: "#fafafa",
          flexShrink: 0,
        }}
      >
        <Sidebar
          selectedFolderId={selectedFolder?.id ?? null}
          selectedTaskId={selectedTask?.id ?? null}
          workingTaskId={working ? selectedTask?.id ?? null : null}
          onSelectFolder={handleFolderSelect}
          onSelectTask={handleTaskSelect}
        />
      </div>

      {/* Right: Chat + Plan */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {selectedTask ? (
          <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
              <ChatPanel
                taskId={selectedTask.id}
                sessionId={sessionId}
                initialMessages={initialMessages}
                onSessionIdChange={setSessionId}
                onStreamingChange={handleStreamingDone}
                planVisible={planVisible}
                onTogglePlan={() => setPlanVisible(!planVisible)}
                hasPlan={selectedTask.plan_paths.length > 0}
              />
            </div>
            {planVisible && (
              <div
                style={{
                  width: 4,
                  cursor: "col-resize",
                  background: "#e0e0e0",
                  flexShrink: 0,
                  transition: "background 0.15s",
                }}
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
                onMouseEnter={(e) => (e.currentTarget.style.background = "#1976d2")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#e0e0e0")}
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
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#999",
            }}
          >
            选择一个任务开始对话
          </div>
        )}
      </div>
    </div>
  );
}
