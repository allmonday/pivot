import { useEffect, useMemo, useState } from "react";
import type { Task, Folder } from "./types";
import {
  SIDEBAR_WIDTH,
  FILE_EXPLORER_MIN_HEIGHT, FILE_EXPLORER_MAX_HEIGHT, FILE_EXPLORER_MIN_WIDTH,
  PLAN_PANEL_MIN_WIDTH, HISTORY_PANEL_MIN_WIDTH,
  TERMINAL_MIN_HEIGHT, TERMINAL_MAX_HEIGHT,
  PANEL_MAX_WIDTH_RATIO,
} from "./constants";
import { Sidebar } from "./components/Sidebar";
import { ChatPanel } from "./components/ChatPanel";
import { PlanPanel } from "./components/PlanPanel";
import { TerminalPanel } from "./components/TerminalPanel";
import { ResizeHandle } from "./components/ui/resize-handle";
import { HistoryPanel } from "./components/HistoryPanel";
import { FileExplorerPanel } from "./components/FileExplorerPanel";
import { fetchFolders, fetchTasks, fetchPlans } from "./api";
import { useChatSession } from "./hooks/useChatSession";
import { useTaskActivity } from "./hooks/useTaskActivity";
import { useResizable } from "./hooks/useResizable";
import { LayoutProvider, useLayout } from "./hooks/useLayout";

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
  return (
    <LayoutProvider>
      <AppContent />
    </LayoutProvider>
  );
}

function AppContent() {
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [planPaths, setPlanPaths] = useState<string[]>([]);

  const chatSession = useChatSession();
  const activity = useTaskActivity(selectedTask?.id ?? null);
  const layout = useLayout();

  const fileExplorerVerticalResize = useResizable({
    direction: "vertical",
    size: layout.fileExplorerHeight,
    onSizeChange: layout.setFileExplorerHeight,
    min: FILE_EXPLORER_MIN_HEIGHT,
    max: FILE_EXPLORER_MAX_HEIGHT,
  });

  const fileExplorerHorizontalResize = useResizable({
    direction: "horizontal",
    size: layout.fileExplorerHeight,
    onSizeChange: layout.setFileExplorerHeight,
    min: FILE_EXPLORER_MIN_WIDTH,
    max: useMemo(() => window.innerWidth * PANEL_MAX_WIDTH_RATIO, []),
  });

  const planResize = useResizable({
    direction: "horizontal",
    size: layout.planWidth,
    onSizeChange: layout.setPlanWidth,
    min: PLAN_PANEL_MIN_WIDTH,
    max: useMemo(() => window.innerWidth * PANEL_MAX_WIDTH_RATIO, []),
  });

  const historyResize = useResizable({
    direction: "horizontal",
    size: layout.historyWidth,
    onSizeChange: layout.setHistoryWidth,
    min: HISTORY_PANEL_MIN_WIDTH,
    max: useMemo(() => window.innerWidth * PANEL_MAX_WIDTH_RATIO, []),
  });

  const terminalResize = useResizable({
    direction: "vertical",
    size: layout.terminalHeight,
    onSizeChange: layout.setTerminalHeight,
    min: TERMINAL_MIN_HEIGHT,
    max: TERMINAL_MAX_HEIGHT,
  });

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
      activity.markWorking(taskId, selectedTask?.name);
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

  // Handle notification click navigation
  useEffect(() => {
    const handler = (e: Event) => {
      const { taskId } = (e as CustomEvent).detail;
      fetchTasks().then((tasks) => {
        const task = tasks.find((t) => t.id === taskId);
        if (task) handleTaskSelect(task);
      });
    };
    window.addEventListener("notification-navigate", handler);
    return () => window.removeEventListener("notification-navigate", handler);
  });

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
      <div
        className="border-r border-border overflow-auto bg-muted/50 shrink-0 transition-[width] duration-200"
        style={{ width: layout.sidebarVisible ? SIDEBAR_WIDTH : 0 }}
      >
        <div style={{ width: SIDEBAR_WIDTH, minWidth: SIDEBAR_WIDTH }}>
          <Sidebar
            selectedFolderId={selectedFolder?.id ?? null}
            selectedTaskId={selectedTask?.id ?? null}
            workingTaskIds={activity.workingTaskIds}
            doneTaskIds={activity.doneTaskIds}
            onSelectFolder={handleFolderSelect}
            onSelectTask={handleTaskSelect}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {selectedTask ? (
          <>
          <div className="flex-1 flex min-h-0">
            <div className={`flex-1 flex min-h-0 overflow-hidden ${layout.fileExplorerVisible && layout.fileExplorerLayout === "horizontal" ? "flex-row" : "flex-col"}`}>
              <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
                <ChatPanel
                  taskId={selectedTask.id}
                  sessionId={chatSession.sessionId}
                  initialMessages={chatSession.initialMessages}
                  onSessionIdChange={chatSession.setSessionId}
                  onStreamingChange={(streaming) => handleStreamingChange(selectedTask.id, streaming)}
                  hasPlan={planPaths.length > 0}
                  hasFolder={!!selectedFolder}
                  hasCompact={chatSession.hasCompact}
                  folderPath={selectedFolder?.folder_path ?? null}
                />
              </div>
              {layout.fileExplorerVisible && layout.fileExplorerLayout === "vertical" && (
                <ResizeHandle
                  direction="vertical"
                  onMouseDown={fileExplorerVerticalResize}
                />
              )}
              {layout.fileExplorerVisible && layout.fileExplorerLayout === "horizontal" && (
                <ResizeHandle
                  direction="horizontal"
                  onMouseDown={fileExplorerHorizontalResize}
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
              <ResizeHandle
                direction="horizontal"
                onMouseDown={planResize}
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
              <ResizeHandle
                direction="horizontal"
                onMouseDown={historyResize}
              />
            )}
            <HistoryPanel
              taskId={selectedTask.id}
              visible={layout.historyVisible}
              onClose={layout.closeHistory}
              width={layout.historyWidth}
            />
          </div>
          {layout.terminalVisible && (
            <ResizeHandle
              direction="vertical"
              onMouseDown={terminalResize}
            />
          )}
          <TerminalPanel
            taskId={selectedTask.id}
            folderPath={selectedFolder?.folder_path ?? null}
            visible={layout.terminalVisible}
            onClose={layout.closeTerminal}
            height={layout.terminalHeight}
          />
        </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            选择一个任务开始对话
          </div>
        )}
      </div>
    </div>
  );
}
