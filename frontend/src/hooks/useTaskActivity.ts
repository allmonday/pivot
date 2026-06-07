import { useEffect, useRef, useState } from "react";
import { checkActiveStreams, fetchTasks } from "../api";

function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function showTaskDoneNotification(taskName: string, taskId: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const notification = new Notification("Task Completed", {
    body: `"${taskName}" has finished.`,
    tag: `task-done-${taskId}`,
  });
  notification.onclick = () => {
    window.focus();
    window.dispatchEvent(new CustomEvent("notification-navigate", { detail: { taskId } }));
    notification.close();
  };
}

export function useTaskActivity(selectedTaskId: string | null) {
  const [workingTaskIds, setWorkingTaskIds] = useState<Set<string>>(new Set());
  const [doneTaskIds, setDoneTaskIds] = useState<Set<string>>(new Set());
  const [planRefreshKey, setPlanRefreshKey] = useState(0);
  const taskNames = useRef<Map<string, string>>(new Map());

  const markWorking = (taskId: string, taskName?: string) => {
    if (taskName) taskNames.current.set(taskId, taskName);
    requestNotificationPermission();
    setWorkingTaskIds((prev) => { const n = new Set(prev); n.add(taskId); return n; });
    setDoneTaskIds((prev) => { if (!prev.has(taskId)) return prev; const n = new Set(prev); n.delete(taskId); return n; });
  };

  const markDone = (taskId: string) => {
    const name = taskNames.current.get(taskId) ?? "Task";
    setWorkingTaskIds((prev) => { const n = new Set(prev); n.delete(taskId); return n; });
    setDoneTaskIds((prev) => { const n = new Set(prev); n.add(taskId); return n; });
    setPlanRefreshKey((k) => k + 1);
    if (taskId !== selectedTaskId || document.hidden) {
      showTaskDoneNotification(name, taskId);
    }
  };

  const clearDone = (taskId: string) => {
    setDoneTaskIds((prev) => { if (!prev.has(taskId)) return prev; const n = new Set(prev); n.delete(taskId); return n; });
  };

  // Poll background tasks
  useEffect(() => {
    const bgIds = [...workingTaskIds].filter((id) => id !== selectedTaskId);
    if (bgIds.length === 0) return;
    const timer = setInterval(() => {
      checkActiveStreams(bgIds).then(({ active_ids }) => {
        const activeSet = new Set(active_ids);
        const finished = bgIds.filter((id) => !activeSet.has(id));
        if (finished.length > 0) {
          setWorkingTaskIds((prev) => {
            const next = new Set(prev);
            for (const id of finished) next.delete(id);
            return next;
          });
          setDoneTaskIds((prev) => {
            const next = new Set(prev);
            for (const id of finished) next.add(id);
            return next;
          });
          for (const id of finished) {
            const name = taskNames.current.get(id) ?? "Task";
            showTaskDoneNotification(name, id);
          }
        }
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [workingTaskIds, selectedTaskId]);

  return {
    workingTaskIds,
    doneTaskIds,
    planRefreshKey,
    markWorking,
    markDone,
    clearDone,
  };
}
