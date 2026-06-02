import { useEffect, useState } from "react";
import type { Task } from "../types";
import { fetchTasks, createTask, deleteTask } from "../api";

interface Props {
  folderId: string | null;
  selectedTaskId: string | null;
  workingTaskId: string | null;
  onSelectTask: (task: Task) => void;
}

export function TaskList({ folderId, selectedTaskId, workingTaskId, onSelectTask }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [taskName, setTaskName] = useState("");
  const [creating, setCreating] = useState(false);

  const reload = () => {
    if (folderId) {
      fetchTasks(folderId).then(setTasks).catch(console.error);
    } else {
      setTasks([]);
    }
  };

  useEffect(() => { reload(); }, [folderId]);

  const handleCreate = async () => {
    if (!taskName.trim() || !folderId) return;
    setCreating(true);
    try {
      const task = await createTask({ name: taskName.trim(), folder_id: folderId });
      await reload();
      onSelectTask(task);
      setTaskName("");
      setShowForm(false);
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    if (!confirm("确认删除此任务？")) return;
    try {
      await deleteTask(taskId);
      await reload();
    } catch (err) {
      console.error(err);
    }
  };

  if (!folderId) {
    return (
      <div style={{ padding: 16, color: "#999" }}>选择一个文件夹查看任务</div>
    );
  }

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", height: "100%" }}>
      <h3 style={{ margin: "0 0 12px 0", fontSize: 14, color: "#666" }}>Tasks</h3>

      <div style={{ flex: 1, overflow: "auto" }}>
        {tasks.map((task) => {
          const isSelected = selectedTaskId === task.id;
          const isWorking = workingTaskId === task.id;
          return (
            <div
              key={task.id}
              onClick={() => onSelectTask(task)}
              style={{
                padding: "8px 12px",
                marginBottom: 4,
                borderRadius: 6,
                cursor: "pointer",
                background: isSelected ? "#e3f2fd" : "transparent",
                fontSize: 14,
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
                onClick={(e) => handleDelete(e, task.id)}
                style={{
                  marginLeft: 8,
                  color: "#ccc",
                  cursor: "pointer",
                  fontSize: 16,
                  lineHeight: 1,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#e53935")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#ccc")}
              >
                ×
              </span>
            </div>
          );
        })}
      </div>

      {/* Create form */}
      {showForm ? (
        <div style={{ borderTop: "1px solid #e0e0e0", paddingTop: 12, marginTop: 8 }}>
          <input
            placeholder="任务名称"
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            style={{
              width: "100%",
              padding: "6px 8px",
              border: "1px solid #ddd",
              borderRadius: 4,
              fontSize: 13,
              boxSizing: "border-box",
              marginBottom: 6,
            }}
          />
          <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
            <button
              onClick={() => { setShowForm(false); setTaskName(""); }}
              style={{ padding: "4px 12px", border: "1px solid #ddd", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
            >
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !taskName.trim()}
              style={{
                padding: "4px 12px",
                border: "none",
                borderRadius: 4,
                background: creating || !taskName.trim() ? "#ccc" : "#1976d2",
                color: "#fff",
                cursor: creating ? "wait" : "pointer",
                fontSize: 12,
              }}
            >
              {creating ? "创建中..." : "创建"}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          style={{
            marginTop: 8,
            width: "100%",
            padding: "6px",
            border: "1px dashed #ccc",
            borderRadius: 4,
            background: "transparent",
            cursor: "pointer",
            fontSize: 16,
            color: "#999",
          }}
        >
          + 新建任务
        </button>
      )}
    </div>
  );
}
