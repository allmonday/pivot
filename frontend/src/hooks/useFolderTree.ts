import { useCallback, useEffect, useState } from "react";
import type { Folder, Task } from "../types";
import { fetchFolders, fetchTasks, createFolder, createTask, deleteFolder, deleteTask, summarizeTask } from "../api";

export function useFolderTree() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tasksMap, setTasksMap] = useState<Record<string, Task[]>>({});
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());

  const [summarizingTaskId, setSummarizingTaskId] = useState<string | null>(null);

  const reloadFolders = useCallback(() => {
    return fetchFolders().then(setFolders).catch(console.error);
  }, []);

  const reloadTasks = useCallback((folderId: string) => {
    fetchTasks(folderId).then((tasks) => setTasksMap((prev) => ({ ...prev, [folderId]: tasks }))).catch(console.error);
  }, []);

  useEffect(() => {
    fetchFolders().then((fetchedFolders) => {
      setFolders(fetchedFolders);
      setExpandedFolderIds(new Set(fetchedFolders.map((f) => f.id)));
      fetchedFolders.forEach((f) => reloadTasks(f.id));
    }).catch(console.error);
  }, [reloadTasks]);

  const toggleFolder = (folder: Folder, onSelect: (folder: Folder) => void) => {
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folder.id)) {
        next.delete(folder.id);
      } else {
        next.add(folder.id);
        onSelect(folder);
        if (!(folder.id in tasksMap)) reloadTasks(folder.id);
      }
      return next;
    });
  };

  const addFolder = async (params: { name: string; folder_path: string; task_names: string[] }, onSelect: (folder: Folder) => void) => {
    const folder = await createFolder(params);
    await reloadFolders();
    setExpandedFolderIds((prev) => new Set(prev).add(folder.id));
    reloadTasks(folder.id);
    onSelect(folder);
    return folder;
  };

  const removeFolder = async (folderId: string) => {
    await deleteFolder(folderId);
    setExpandedFolderIds((prev) => { const next = new Set(prev); next.delete(folderId); return next; });
    await reloadFolders();
  };

  const addTask = async (params: { name: string; folder_id: string }, onSelect: (task: Task) => void) => {
    const task = await createTask(params);
    await reloadTasks(params.folder_id);
    onSelect(task);
    return task;
  };

  const removeTask = async (taskId: string, folderId: string) => {
    await deleteTask(taskId);
    await reloadTasks(folderId);
  };

  const summarize = async (taskId: string, folderId: string) => {
    setSummarizingTaskId(taskId);
    try {
      const result = await summarizeTask(taskId);
      setTasksMap((prev) => ({
        ...prev,
        [folderId]: (prev[folderId] || []).map((t) =>
          t.id === taskId ? { ...t, summary: result.summary } : t
        ),
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setSummarizingTaskId(null);
    }
  };

  return {
    folders,
    tasksMap,
    expandedFolderIds,
    summarizingTaskId,
    toggleFolder,
    addFolder,
    removeFolder,
    addTask,
    removeTask,
    summarize,
  };
}
