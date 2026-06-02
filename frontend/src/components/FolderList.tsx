import { useEffect, useState } from "react";
import type { Folder } from "../types";
import { fetchFolders, createFolder, deleteFolder } from "../api";
import { FolderPicker } from "./FolderPicker";

interface Props {
  selectedFolderId: string | null;
  onSelectFolder: (folder: Folder) => void;
}

export function FolderList({ selectedFolderId, onSelectFolder }: Props) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderPath, setFolderPath] = useState("");
  const [taskNames, setTaskNames] = useState("");
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [creating, setCreating] = useState(false);
  const [hoveredInfo, setHoveredInfo] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const reload = () => fetchFolders().then(setFolders).catch(console.error);

  useEffect(() => { reload(); }, []);

  const handleCreate = async () => {
    if (!folderName.trim() || !folderPath.trim()) return;
    setCreating(true);
    try {
      const names = taskNames
        .split("\n")
        .map((n) => n.trim())
        .filter(Boolean);
      const folder = await createFolder({
        name: folderName.trim(),
        folder_path: folderPath.trim(),
        task_names: names,
      });
      await reload();
      onSelectFolder(folder);
      setFolderName("");
      setFolderPath("");
      setTaskNames("");
      setShowForm(false);
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, folderId: string) => {
    e.stopPropagation();
    if (!confirm("确认删除此文件夹及其所有任务？")) return;
    try {
      await deleteFolder(folderId);
      await reload();
    } catch (err) {
      console.error(err);
    }
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
          const isSelected = selectedFolderId === folder.id;
          return (
            <div
              key={folder.id}
              onClick={() => onSelectFolder(folder)}
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
                {folder.name}
              </span>
              <span
                style={{ position: "relative", marginLeft: 6, cursor: "help", fontSize: 13, color: hoveredInfo === folder.id ? "#1976d2" : "#bbb" }}
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
              <span
                onClick={(e) => handleDelete(e, folder.id)}
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
            placeholder="文件夹名称"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
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
          <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
            <input
              placeholder="目录路径"
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              style={{
                flex: 1,
                padding: "6px 8px",
                border: "1px solid #ddd",
                borderRadius: 4,
                fontSize: 12,
              }}
            />
            <button
              onClick={() => setShowFolderPicker(true)}
              style={{
                padding: "6px 10px",
                border: "1px solid #ddd",
                borderRadius: 4,
                background: "#f5f5f5",
                cursor: "pointer",
                fontSize: 12,
                whiteSpace: "nowrap",
              }}
            >
              浏览
            </button>
          </div>
          <textarea
            placeholder="初始任务（每行一个，可选）"
            value={taskNames}
            onChange={(e) => setTaskNames(e.target.value)}
            rows={3}
            style={{
              width: "100%",
              padding: "6px 8px",
              border: "1px solid #ddd",
              borderRadius: 4,
              fontSize: 12,
              boxSizing: "border-box",
              marginBottom: 8,
              resize: "vertical",
            }}
          />
          <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
            <button
              onClick={() => { setShowForm(false); setFolderName(""); setFolderPath(""); setTaskNames(""); }}
              style={{ padding: "4px 12px", border: "1px solid #ddd", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
            >
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !folderName.trim() || !folderPath.trim()}
              style={{
                padding: "4px 12px",
                border: "none",
                borderRadius: 4,
                background: creating || !folderName.trim() || !folderPath.trim() ? "#ccc" : "#1976d2",
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
          + 新建文件夹
        </button>
      )}

      {showFolderPicker && (
        <FolderPicker
          initialPath={folderPath || "/"}
          onSelect={(path) => {
            setFolderPath(path);
            setShowFolderPicker(false);
          }}
          onCancel={() => setShowFolderPicker(false)}
        />
      )}
    </div>
  );
}
