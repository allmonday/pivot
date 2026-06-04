import { useEffect, useState } from "react";
import type { Task, Folder } from "./types";
import { Sidebar } from "./components/Sidebar";
import { ChatPanel } from "./components/ChatPanel";
import { PlanPanel } from "./components/PlanPanel";
import { HistoryPanel } from "./components/HistoryPanel";
import { FileExplorerPanel } from "./components/FileExplorerPanel";
import { fetchFolders, fetchTasks, fetchPlans } from "./api";
import { useChatSession } from "./hooks/useChatSession";
import { useTaskActivity } from "./hooks/useTaskActivity";
import { useLayout } from "./hooks/useLayout";

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
  const [planPaths, setPlanPaths] = useState<string[]>([]);

  const chatSession = useChatSession();
  const activity = useTaskActivity(selectedTask?.id ?? null);
  const layout = useLayout();

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
    activity.clearDone(task.id);
    setSelectedTask(task);
    const plans = await fetchPlans(task.id);
    setPlanPaths(plans);
    layout.setPlanVisible(plans.length > 0);
    await chatSession.loadSession(task.id);
  };

  const handleStreamingChange = (taskId: string, streaming: boolean) => {
    if (streaming) {
      activity.markWorking(taskId);
    } else {
      activity.markDone(taskId);
      if (selectedTask) {
        fetchPlans(taskId).then((plans) => {
          if (plans.length > planPaths.length) {
            setPlanPaths(plans);
            layout.setPlanVisible(true);
          }
        });
      }
    }
  };

  // Restore state from URL params on mount
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
          fetchPlans(task.id).then((plans) => {
            setPlanPaths(plans);
            layout.setPlanVisible(plans.length > 0);
          });
          chatSession.loadSession(task.id);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-screen font-sans">
      <div className="w-[280px] border-r border-border overflow-auto bg-muted/50 shrink-0">
        <Sidebar
          selectedFolderId={selectedFolder?.id ?? null}
          selectedTaskId={selectedTask?.id ?? null}
          workingTaskIds={activity.workingTaskIds}
          doneTaskIds={activity.doneTaskIds}
          onSelectFolder={handleFolderSelect}
          onSelectTask={handleTaskSelect}
        />
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {selectedTask ? (
          <div className="flex-1 flex min-h-0">
            <div className={`flex-1 flex min-h-0 overflow-hidden ${layout.fileExplorerVisible && layout.fileExplorerLayout === "horizontal" ? "flex-row" : "flex-col"}`}>
              <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
                <ChatPanel
                  taskId={selectedTask.id}
                  sessionId={chatSession.sessionId}
                  initialMessages={chatSession.initialMessages}
                  onSessionIdChange={chatSession.setSessionId}
                  onStreamingChange={(streaming) => handleStreamingChange(selectedTask.id, streaming)}
                  planVisible={layout.planVisible}
                  onTogglePlan={layout.togglePlan}
                  hasPlan={planPaths.length > 0}
                  historyVisible={layout.historyVisible}
                  onToggleHistory={layout.toggleHistory}
                  fileExplorerVisible={layout.fileExplorerVisible}
                  onToggleFileExplorer={layout.toggleFileExplorer}
                  fileExplorerLayout={layout.fileExplorerLayout}
                  onToggleFileExplorerLayout={layout.toggleFileExplorerLayout}
                  hasFolder={!!selectedFolder}
                />
              </div>
              {layout.fileExplorerVisible && layout.fileExplorerLayout === "vertical" && (
                <div
                  className="h-1 cursor-row-resize bg-border shrink-0 transition-colors hover:bg-primary"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const startY = e.clientY;
                    const startHeight = layout.fileExplorerHeight;
                    const onMove = (ev: MouseEvent) => {
                      const delta = startY - ev.clientY;
                      layout.setFileExplorerHeight(Math.max(150, Math.min(600, startHeight + delta)));
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
              {layout.fileExplorerVisible && layout.fileExplorerLayout === "horizontal" && (
                <div
                  className="w-1 cursor-col-resize bg-border shrink-0 transition-colors hover:bg-primary"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const startX = e.clientX;
                    const startWidth = layout.fileExplorerHeight;
                    const onMove = (ev: MouseEvent) => {
                      const delta = startX - ev.clientX;
                      layout.setFileExplorerHeight(Math.max(200, Math.min(window.innerWidth * 0.7, startWidth + delta)));
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
              <FileExplorerPanel
                folderPath={selectedFolder?.folder_path ?? null}
                visible={layout.fileExplorerVisible}
                onClose={layout.closeFileExplorer}
                height={layout.fileExplorerHeight}
                layout={layout.fileExplorerLayout}
                onToggleLayout={layout.toggleFileExplorerLayout}
              />
            </div>
            {layout.planVisible && (
              <div
                className="w-1 cursor-col-resize bg-border shrink-0 transition-colors hover:bg-primary"
                onMouseDown={(e) => {
                  e.preventDefault();
                  const startX = e.clientX;
                  const startWidth = layout.planWidth;
                  const onMove = (ev: MouseEvent) => {
                    const delta = startX - ev.clientX;
                    layout.setPlanWidth(Math.max(250, Math.min(800, startWidth + delta)));
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
              planPaths={planPaths}
              folderPath={selectedFolder?.folder_path ?? null}
              visible={layout.planVisible}
              onClose={layout.closePlan}
              refreshKey={activity.planRefreshKey}
              width={layout.planWidth}
            />
            {layout.historyVisible && (
              <div
                className="w-1 cursor-col-resize bg-border shrink-0 transition-colors hover:bg-primary"
                onMouseDown={(e) => {
                  e.preventDefault();
                  const startX = e.clientX;
                  const startWidth = layout.historyWidth;
                  const onMove = (ev: MouseEvent) => {
                    const delta = startX - ev.clientX;
                    layout.setHistoryWidth(Math.max(300, Math.min(800, startWidth + delta)));
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
            <HistoryPanel
              taskId={selectedTask.id}
              visible={layout.historyVisible}
              onClose={layout.closeHistory}
              width={layout.historyWidth}
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
