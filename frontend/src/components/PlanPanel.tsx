import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { fetchFileContent } from "../api";

interface Props {
  planPaths: string[];
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

function pathToName(path: string): string {
  return path.split("/").pop() || path;
}

export function PlanPanel({ planPaths, folderPath, visible, onClose, refreshKey, width }: Props) {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const currentPath = planPaths[selectedIndex] ?? null;

  const loadContent = async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const text = await fetchFileContent(path);
      setContent(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load plan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && currentPath) {
      loadContent(currentPath);
    }
  }, [visible, currentPath, refreshKey]);

  // Clamp selectedIndex when planPaths changes
  useEffect(() => {
    if (selectedIndex >= planPaths.length) {
      setSelectedIndex(Math.max(0, planPaths.length - 1));
    }
  }, [planPaths.length]);

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

      {/* Dropdown selector */}
      {planPaths.length > 0 && (
        <div
          style={{
            padding: "6px 12px",
            borderBottom: "1px solid #eee",
            background: "#fff",
          }}
        >
          <select
            value={selectedIndex}
            onChange={(e) => setSelectedIndex(Number(e.target.value))}
            style={{
              width: "100%",
              fontSize: 12,
              padding: "4px 6px",
              border: "1px solid #ddd",
              borderRadius: 4,
              background: "#fff",
              color: "#333",
              cursor: "pointer",
            }}
          >
            {planPaths.map((p, i) => (
              <option key={p} value={i}>
                {pathToName(p)}
              </option>
            ))}
          </select>
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
    </div>
  );
}
