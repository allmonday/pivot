import { useEffect, useState } from "react";
import { fetchFileContent } from "../api";
import { X } from "lucide-react";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface Props {
  planPaths: string[];
  folderPath: string | null;
  visible: boolean;
  onClose: () => void;
  refreshKey: number;
  width: number;
}

function pathToName(path: string): string {
  return path.split("/").pop() || path;
}

export function PlanPanel({ planPaths, folderPath: _folderPath, visible, onClose, refreshKey, width }: Props) {
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

  useEffect(() => {
    if (selectedIndex >= planPaths.length) {
      setSelectedIndex(Math.max(0, planPaths.length - 1));
    }
  }, [planPaths.length]);

  if (!visible) return null;

  return (
    <div
      className="border-l border-border flex flex-col bg-muted/50 shrink-0"
      style={{ width }}
    >
      <div className="px-3 py-2 border-b border-border flex justify-between items-center bg-background">
        <span className="text-[13px] font-semibold text-foreground">Plan</span>
        <X
          className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
          onClick={onClose}
        />
      </div>

      {planPaths.length > 0 && (
        <div className="px-3 py-1.5 border-b border-border/50 bg-background">
          <select
            value={selectedIndex}
            onChange={(e) => setSelectedIndex(Number(e.target.value))}
            className="w-full text-xs py-1 px-1.5 border border-border rounded bg-background text-foreground cursor-pointer"
          >
            {planPaths.map((p, i) => (
              <option key={p} value={i}>
                {pathToName(p)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex-1 overflow-auto px-4 py-3 scrollbar-thin">
        {loading ? (
          <div className="text-muted-foreground text-[13px]">Loading...</div>
        ) : error ? (
          <div className="text-destructive text-[13px]">{error}</div>
        ) : (
          <div className="text-[13px] leading-relaxed markdown-body">
            <MarkdownRenderer content={content} />
          </div>
        )}
      </div>
    </div>
  );
}
