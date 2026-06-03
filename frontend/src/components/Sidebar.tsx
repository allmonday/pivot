import { useEffect, useState } from "react";
import type { Folder, Task } from "../types";
import { fetchFolders, fetchTasks, createFolder, createTask, deleteFolder, deleteTask } from "../api";
import { FolderPicker } from "./FolderPicker";

interface Props {
  selectedFolderId: string | null;
  selectedTaskId: string | null;
  workingTaskId: string | null;
  onSelectFolder: (folder: Folder) => void;
  onSelectTask: (task: Task) => void;
}

export function Sidebar({ selectedFolderId, selectedTaskId, workingTaskId, onSelectFolder, onSelectTask }: Props) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tasksMap, setTasksMap] = useState<Record<string, Task[]>>({});
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());

  // Folder creation form state
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderPath, setFolderPath] = useState("");
  const [taskNames, setTaskNames] = useState("");
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Task creation form state (per folder)
  const [addingTaskForFolder, setAddingTaskForFolder] = useState<string | null>(null);
  const [newTaskName, setNewTaskName] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);

  // Tooltip
  const [hoveredInfo, setHoveredInfo] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const reloadFolders = () => fetchFolders().then(setFolders).catch(console.error);

  const reloadTasks = (folderId: string) => {
    fetchTasks(folderId).then((tasks) => setTasksMap((prev) => ({ ...prev, [folderId]: tasks }))).catch(console.error);
  };

  useEffect(() => {
    fetchFolders().then((folds) => {
      setFolders(folds);
      setExpandedFolderIds(new Set(folds.map(f => f.id)));
      folds.forEach(f => reloadTasks(f.id));
    }).catch(console.error);
  }, []);

  const handleFolderClick = (folder: Folder) => {
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folder.id)) {
        next.delete(folder.id);
      } else {
        next.add(folder.id);
        onSelectFolder(folder);
      }
      return next;
    });
  };

  const handleFolderCreate = async () => {
    if (!folderName.trim() || !folderPath.trim()) return;
    setCreatingFolder(true);
    try {
      const names = taskNames.split("\n").map((n) => n.trim()).filter(Boolean);
      const folder = await createFolder({ name: folderName.trim(), folder_path: folderPath.trim(), task_names: names });
      await reloadFolders();
      setExpandedFolderIds((prev) => new Set(prev).add(folder.id));
      reloadTasks(folder.id);
      onSelectFolder(folder);
      setFolderName("");
      setFolderPath("");
      setTaskNames("");
      setShowFolderForm(false);
    } catch (e) {
      console.error(e);
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleFolderDelete = async (e: React.MouseEvent, folderId: string) => {
    e.stopPropagation();
    if (!confirm("确认删除此文件夹及其所有任务？")) return;
    try {
      await deleteFolder(folderId);
      if (expandedFolderIds.has(folderId)) setExpandedFolderIds((prev) => { const next = new Set(prev); next.delete(folderId); return next; });
      await reloadFolders();
    } catch (err) {
      console.error(err);
    }
  };

  const handleTaskCreate = async () => {
    if (!newTaskName.trim() || !addingTaskForFolder) return;
    setCreatingTask(true);
    try {
      const task = await createTask({ name: newTaskName.trim(), folder_id: addingTaskForFolder });
      await reloadTasks(addingTaskForFolder);
      onSelectTask(task);
      setNewTaskName("");
      setAddingTaskForFolder(null);
    } catch (e) {
      console.error(e);
    } finally {
      setCreatingTask(false);
    }
  };

  const handleTaskDelete = async (e: React.MouseEvent, taskId: string, folderId: string) => {
    e.stopPropagation();
    if (!confirm("确认删除此任务？")) return;
    try {
      await deleteTask(taskId);
      await reloadTasks(folderId);
    } catch (err) {
      console.error(err);
    }
  };

  const startAddTask = (e: React.MouseEvent, folderId: string) => {
    e.stopPropagation();
    setAddingTaskForFolder(folderId);
    setNewTaskName("");
  };

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", height: "100%" }}>
      {hoveredInfo && (
        <span style={{
          position: "fixed",
          left: tooltipPos.x,
          top: tooltipPos.y,
          transform: "translateY(-50%)",
          background: "#333",
          color: "#fff",
          fontSize: 11,
          padding: "4px 8px",
          borderRadius: 4,
          whiteSpace: "nowrap",
          zIndex: 9999,
          pointerEvents: "none",
        }}>
          {folders.find(f => f.id === hoveredInfo)?.folder_path}
        </span>
      )}

      <h3 style={{ margin: "0 0 12px 0", fontSize: 14, color: "#666" }}>Folders</h3>

      <div style={{ flex: 1, overflow: "auto" }}>
        {folders.map((folder) => {
          const isExpanded = expandedFolderIds.has(folder.id);
          const tasks = tasksMap[folder.id] || [];
          return (
            <div key={folder.id}>
              {/* Folder row */}
              <div
                style={{
                  padding: "8px 12px",
                  marginBottom: 2,
                  borderRadius: 6,
                  cursor: "pointer",
                  background: "transparent",
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
                onClick={() => handleFolderClick(folder)}
              >
                <span style={{ fontSize: 10, color: "#999", width: 12, flexShrink: 0 }}>
                  {isExpanded ? "▼" : "▶"}
                </span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                  {folder.name}
                </span>
                {/* + add task */}
                <span
                  onClick={(e) => startAddTask(e, folder.id)}
                  style={{
                    cursor: "pointer",
                    fontSize: 15,
                    color: "#bbb",
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#1976d2")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#bbb")}
                >
                  +
                </span>
                {/* info */}
                <span
                  style={{ cursor: "help", fontSize: 13, color: hoveredInfo === folder.id ? "#1976d2" : "#bbb", flexShrink: 0 }}
                  onMouseEnter={(e) => {
                    setHoveredInfo(folder.id);
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTooltipPos({ x: rect.right + 4, y: rect.top + rect.height / 2 });
                  }}
                  onMouseLeave={() => setHoveredInfo(null)}
                  onClick={(e) => e.stopPropagation()}
                >
                  &#9432;
                </span>
                {/* delete */}
                <span
                  onClick={(e) => handleFolderDelete(e, folder.id)}
                  style={{ color: "#ccc", cursor: "pointer", fontSize: 16, lineHeight: 1, flexShrink: 0 }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#e53935")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#ccc")}
                >
                  ×
                </span>
              </div>

              {/* Tasks under folder */}
              {isExpanded && (
                <div style={{ marginLeft: 16 }}>
                  {tasks.map((task) => {
                    const isSelected = selectedTaskId === task.id;
                    const isWorking = workingTaskId === task.id;
                    return (
                      <div
                        key={task.id}
                        onClick={() => onSelectTask(task)}
                        style={{
                          padding: "6px 12px",
                          marginBottom: 2,
                          borderRadius: 6,
                          cursor: "pointer",
                          background: isSelected ? "#e3f2fd" : "transparent",
                          fontSize: 13,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                          {task.name}
                        </span>
                        {isWorking && (
                          <span style={{ fontSize: 11, color: "#ff9800", marginLeft: 4 }}>working</span>
                        )}
                        <span
                          onClick={(e) => handleTaskDelete(e, task.id, folder.id)}
                          style={{ marginLeft: 8, color: "#ccc", cursor: "pointer", fontSize: 16, lineHeight: 1 }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "#e53935")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "#ccc")}
                        >
                          ×
                        </span>
                      </div>
                    );
                  })}

                  {/* Inline add task form */}
                  {addingTaskForFolder === folder.id && (
                    <div style={{ padding: "6px 0", display: "flex", gap: 4, alignItems: "center" }}>
                      <input
                        placeholder="任务名称"
                        value={newTaskName}
                        onChange={(e) => setNewTaskName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleTaskCreate();
                          if (e.key === "Escape") setAddingTaskForFolder(null);
                        }}
                        autoFocus
                        style={{
                          flex: 1,
                          padding: "4px 8px",
                          border: "1px solid #ddd",
                          borderRadius: 4,
                          fontSize: 12,
                        }}
                      />
                      <button
                        onClick={handleTaskCreate}
                        disabled={creatingTask || !newTaskName.trim()}
                        style={{
                          padding: "4px 10px",
                          border: "none",
                          borderRadius: 4,
                          background: creatingTask || !newTaskName.trim() ? "#ccc" : "#1976d2",
                          color: "#fff",
                          cursor: creatingTask ? "wait" : "pointer",
                          fontSize: 12,
                        }}
                      >
                        {creatingTask ? "..." : "确认"}
                      </button>
                      <button
                        onClick={() => setAddingTaskForFolder(null)}
                        style={{ padding: "4px 8px", border: "1px solid #ddd", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
                      >
                        取消
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create folder form */}
      {showFolderForm ? (
        <div style={{ borderTop: "1px solid #e0e0e0", paddingTop: 12, marginTop: 8 }}>
          <input
            placeholder="文件夹名称"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            style={{ width: "100%", padding: "6px 8px", border: "1px solid #ddd", borderRadius: 4, fontSize: 13, boxSizing: "border-box", marginBottom: 6 }}
          />
          <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
            <input
              placeholder="目录路径"
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              style={{ flex: 1, padding: "6px 8px", border: "1px solid #ddd", borderRadius: 4, fontSize: 12 }}
            />
            <button
              onClick={() => setShowFolderPicker(true)}
              style={{ padding: "6px 10px", border: "1px solid #ddd", borderRadius: 4, background: "#f5f5f5", cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }}
            >
              浏览
            </button>
          </div>
          <textarea
            placeholder="初始任务（每行一个，可选）"
            value={taskNames}
            onChange={(e) => setTaskNames(e.target.value)}
            rows={3}
            style={{ width: "100%", padding: "6px 8px", border: "1px solid #ddd", borderRadius: 4, fontSize: 12, boxSizing: "border-box", marginBottom: 8, resize: "vertical" }}
          />
          <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
            <button
              onClick={() => { setShowFolderForm(false); setFolderName(""); setFolderPath(""); setTaskNames(""); }}
              style={{ padding: "4px 12px", border: "1px solid #ddd", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
            >
              取消
            </button>
            <button
              onClick={handleFolderCreate}
              disabled={creatingFolder || !folderName.trim() || !folderPath.trim()}
              style={{
                padding: "4px 12px", border: "none", borderRadius: 4,
                background: creatingFolder || !folderName.trim() || !folderPath.trim() ? "#ccc" : "#1976d2",
                color: "#fff", cursor: creatingFolder ? "wait" : "pointer", fontSize: 12,
              }}
            >
              {creatingFolder ? "创建中..." : "创建"}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowFolderForm(true)}
          style={{
            marginTop: 8, width: "100%", padding: "6px", border: "1px dashed #ccc",
            borderRadius: 4, background: "transparent", cursor: "pointer", fontSize: 14, color: "#999",
          }}
        >
          + 新建文件夹
        </button>
      )}

      {showFolderPicker && (
        <FolderPicker
          initialPath={folderPath || "/"}
          onSelect={(path) => { setFolderPath(path); setShowFolderPicker(false); }}
          onCancel={() => setShowFolderPicker(false)}
        />
      )}
    </div>
  );
}
