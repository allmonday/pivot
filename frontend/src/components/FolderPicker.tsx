import { useEffect, useState } from "react";
import type { FileInfo } from "../types";
import { fetchFiles } from "../api";

interface Props {
  initialPath: string;
  onSelect: (path: string) => void;
  onCancel: () => void;
}

export function FolderPicker({ initialPath, onSelect, onCancel }: Props) {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFiles(currentPath).then(setFiles).catch((e) => setError(e.message));
  }, [currentPath]);

  const directories = files.filter((f) => f.is_dir);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 8,
          width: 500,
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #e0e0e0" }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>选择文件夹</h3>
          <div style={{ fontSize: 11, color: "#666", marginTop: 4, wordBreak: "break-all" }}>
            {currentPath}
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "8px 0", maxHeight: 400 }}>
          {error && (
            <div style={{ color: "red", fontSize: 12, padding: "4px 16px" }}>{error}</div>
          )}

          <div
            onClick={() => {
              const parent = currentPath.split("/").slice(0, -1).join("/") || "/";
              setCurrentPath(parent);
            }}
            style={{
              padding: "6px 16px",
              cursor: "pointer",
              color: "#1976d2",
              fontSize: 13,
            }}
          >
            ..
          </div>

          {directories.map((dir) => (
            <div
              key={dir.path}
              onClick={() => setCurrentPath(dir.path)}
              style={{
                padding: "6px 16px",
                cursor: "pointer",
                fontSize: 13,
                color: "#1976d2",
              }}
            >
              {dir.name}
            </div>
          ))}
        </div>

        <div
          style={{
            padding: "8px 16px",
            borderTop: "1px solid #e0e0e0",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button
            onClick={onCancel}
            style={{ padding: "6px 16px", border: "1px solid #ccc", borderRadius: 4, cursor: "pointer" }}
          >
            取消
          </button>
          <button
            onClick={() => onSelect(currentPath)}
            style={{
              padding: "6px 16px",
              border: "none",
              borderRadius: 4,
              background: "#1976d2",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            选择此文件夹
          </button>
        </div>
      </div>
    </div>
  );
}
