import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import type { PlanFile } from "../types";
import { fetchFileContent, fetchPlanFiles } from "../api";

interface Props {
  planPath: string | null;
  folderPath: string | null;
  visible: boolean;
  onClose: () => void;
  refreshKey: number;
  width: number;
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    const text = extractText(children);
    navigator.clipboard.writeText(text.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="code-block-wrapper">
      <pre>{children}</pre>
      <button className="code-copy-btn" onClick={handleCopy}>
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

function extractText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node && typeof node === "object" && "props" in node) {
    return extractText((node as { props: { children?: React.ReactNode } }).props.children);
  }
  return "";
}

export function PlanPanel({ planPath, folderPath, visible, onClose, refreshKey, width }: Props) {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planFiles, setPlanFiles] = useState<PlanFile[]>([]);
  const [currentPath, setCurrentPath] = useState<string | null>(planPath);
  const [showHistory, setShowHistory] = useState(false);

  const loadContent = async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const text = await fetchFileContent(path);
      setContent(text);
      setCurrentPath(path);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load plan");
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    if (!folderPath) return;
    try {
      const files = await fetchPlanFiles(folderPath);
      setPlanFiles(files);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (visible && planPath) {
      loadContent(planPath);
      loadHistory();
    }
  }, [visible, planPath, refreshKey]);

  if (!visible) return null;

  return (
    <div
      style={{
        width,
        borderLeft: "1px solid #e0e0e0",
        display: "flex",
        flexDirection: "column",
        background: "#fafafa",
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid #e0e0e0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#fff",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>Plan</span>
        <span
          onClick={onClose}
          style={{ cursor: "pointer", fontSize: 16, color: "#999", lineHeight: 1 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#333")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#999")}
        >
          ×
        </span>
      </div>

      {/* File path */}
      {currentPath && (
        <div
          style={{
            padding: "4px 12px",
            fontSize: 11,
            color: "#999",
            borderBottom: "1px solid #eee",
            background: "#fff",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {currentPath.split("/").pop()}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: "12px 16px" }}>
        {loading ? (
          <div style={{ color: "#999", fontSize: 13 }}>Loading...</div>
        ) : error ? (
          <div style={{ color: "#e53935", fontSize: 13 }}>{error}</div>
        ) : (
          <div style={{ fontSize: 13, lineHeight: 1.6 }} className="markdown-body">
            <Markdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{ pre: CodeBlock }}
            >
              {content}
            </Markdown>
          </div>
        )}
      </div>

      {/* History */}
      {planFiles.length > 0 && (
        <div style={{ borderTop: "1px solid #e0e0e0", background: "#fff" }}>
          <div
            onClick={() => setShowHistory(!showHistory)}
            style={{
              padding: "8px 12px",
              cursor: "pointer",
              fontSize: 12,
              color: "#666",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>History ({planFiles.length})</span>
            <span>{showHistory ? "▲" : "▼"}</span>
          </div>
          {showHistory && (
            <div style={{ maxHeight: 200, overflow: "auto", padding: "0 12px 8px" }}>
              {planFiles.map((pf) => (
                <div
                  key={pf.path}
                  onClick={() => loadContent(pf.path)}
                  style={{
                    padding: "4px 8px",
                    marginBottom: 2,
                    borderRadius: 4,
                    cursor: "pointer",
                    fontSize: 12,
                    background: pf.path === currentPath ? "#e3f2fd" : "transparent",
                    color: "#333",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                    {pf.name}
                  </span>
                  <span style={{ color: "#999", fontSize: 11, marginLeft: 8, whiteSpace: "nowrap" }}>
                    {pf.modified_at}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
