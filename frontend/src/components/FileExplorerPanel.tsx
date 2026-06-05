import { useEffect, useState, useCallback } from "react";
import type { FileInfo } from "../types";
import { fetchFiles, fetchFileContent } from "../api";
import { X, FolderIcon, FileText, ChevronRight, ChevronDown, Columns2, Rows2 } from "lucide-react";
import type { FileExplorerLayout } from "../hooks/useLayout";
import { ResizeHandle } from "./ui/resize-handle";
import Editor from "@monaco-editor/react";
import { MarkdownRenderer, MermaidBlock } from "./MarkdownRenderer";

interface Props {
  folderPath: string | null;
  visible: boolean;
  onClose: () => void;
  height: number;
  layout: FileExplorerLayout;
  onToggleLayout?: () => void;
}

interface TreeNode {
  info: FileInfo;
  expanded: boolean;
  children: FileInfo[] | null;
  loading: boolean;
}

function FileTreeItem({
  info,
  depth,
  selectedPath,
  onSelect,
}: {
  info: FileInfo;
  depth: number;
  selectedPath: string | null;
  onSelect: (info: FileInfo) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FileInfo[] | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = useCallback(async () => {
    if (!info.is_dir) return;
    if (expanded) {
      setExpanded(false);
      return;
    }
    if (!children) {
      setLoading(true);
      try {
        const files = await fetchFiles(info.path);
        setChildren(files);
      } catch {
        setChildren([]);
      }
      setLoading(false);
    }
    setExpanded(true);
  }, [info, expanded, children]);

  const isSelected = selectedPath === info.path;

  return (
    <div>
      <div
        className={`flex items-center gap-1 px-1.5 py-[3px] cursor-pointer text-[12px] rounded-sm hover:bg-accent ${
          isSelected ? "bg-primary/10 text-primary" : "text-foreground"
        }`}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
        onClick={() => info.is_dir ? toggle() : onSelect(info)}
      >
        {info.is_dir ? (
          <>
            {expanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
            <FolderIcon className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          </>
        ) : (
          <>
            <span className="w-3" />
            <FileText className="h-3.5 w-3.5 shrink-0 opacity-50" />
          </>
        )}
        <span className="truncate">{info.name}</span>
        {loading && <span className="text-[10px] text-muted-foreground ml-auto">...</span>}
      </div>
      {expanded && children && (
        <div>
          {children.map((child) => (
            <FileTreeItem
              key={child.path}
              info={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileExplorerPanel({ folderPath, visible, onClose, height, layout, onToggleLayout }: Props) {
  const [rootFiles, setRootFiles] = useState<FileInfo[]>([]);
  const [selectedFile, setSelectedFile] = useState<{ path: string; content: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [treeWidth, setTreeWidth] = useState(200);

  useEffect(() => {
    if (!folderPath) return;
    fetchFiles(folderPath).then(setRootFiles).catch(() => setRootFiles([]));
  }, [folderPath]);

  const handleSelect = useCallback(async (info: FileInfo) => {
    setLoading(true);
    try {
      const content = await fetchFileContent(info.path);
      setSelectedFile({ path: info.path, content });
    } catch {
      setSelectedFile(null);
    }
    setLoading(false);
  }, []);

  if (!visible) return null;

  const isVertical = layout === "vertical";

  return (
    <div
      className={`flex bg-muted/50 shrink-0 ${isVertical ? "border-t border-border" : "border-l border-border"}`}
      style={isVertical ? { height } : { width: height }}
    >
      {/* File tree */}
      <div className="shrink-0 flex flex-col" style={{ width: treeWidth }}>
        <div className="px-3 py-2 border-b border-border flex justify-between items-center bg-background">
          <span className="text-[13px] font-semibold text-foreground">Files</span>
          <div className="flex items-center gap-1">
            {onToggleLayout && (
              <button
                className="text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
                onClick={onToggleLayout}
                title={isVertical ? "Switch to left-right layout" : "Switch to top-bottom layout"}
              >
                {isVertical ? <Columns2 className="h-3.5 w-3.5" /> : <Rows2 className="h-3.5 w-3.5" />}
              </button>
            )}
            <button
              className="text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
              onClick={onClose}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto py-1 scrollbar-thin">
          {rootFiles.map((file) => (
            <FileTreeItem
              key={file.path}
              info={file}
              depth={0}
              selectedPath={selectedFile?.path ?? null}
              onSelect={handleSelect}
            />
          ))}
        </div>
      </div>

      {/* Resize handle */}
      <ResizeHandle
        direction="horizontal"
        onMouseDown={(e) => {
          e.preventDefault();
          const startX = e.clientX;
          const startWidth = treeWidth;
          const onMove = (ev: MouseEvent) => {
            const delta = ev.clientX - startX;
            setTreeWidth(Math.max(120, Math.min(500, startWidth + delta)));
          };
          const onUp = () => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
          };
          document.addEventListener("mousemove", onMove);
          document.addEventListener("mouseup", onUp);
        }}
      />

      {/* Editor */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedFile ? (
          <>
            <div className="px-3 py-2 border-b border-border bg-background truncate text-[12px] text-muted-foreground">
              {selectedFile.path.split("/").pop()}
            </div>
            {selectedFile.path.endsWith(".md") ? (
              <div className="flex-1 overflow-auto p-4 scrollbar-thin">
                <div className="markdown-body max-w-full">
                  <MarkdownRenderer content={selectedFile.content} />
                </div>
              </div>
            ) : selectedFile.path.endsWith(".mmd") ? (
              <div className="flex-1 overflow-auto p-4 scrollbar-thin">
                <MermaidBlock code={selectedFile.content} />
              </div>
            ) : (
            <div className="flex-1">
              <Editor
                height="100%"
                path={selectedFile.path}
                defaultValue={selectedFile.content}
                theme="light"
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 13,
                  lineNumbers: "on",
                  renderLineHighlight: "none",
                  overviewRulerBorder: false,
                  hideCursorInOverviewRuler: true,
                  overviewRulerLanes: 0,
                  scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
                }}
              />
            </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-[13px]">
            {loading ? "Loading..." : "Select a file to view"}
          </div>
        )}
      </div>
    </div>
  );
}
