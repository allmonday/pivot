import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import mermaid from "mermaid";

mermaid.initialize({ startOnLoad: false, theme: "default" });

let mermaidCounter = 0;
const mermaidCache = new Map<string, string>();

function MermaidBlock({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<{ svg: string; scale: number; x: number; y: number } | null>(null);
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, startLeft: 0, startTop: 0 });

  useEffect(() => {
    if (!containerRef.current || !code.trim()) return;
    const trimmed = code.trim();

    // Use cached SVG if available
    const cached = mermaidCache.get(trimmed);
    if (cached && containerRef.current) {
      containerRef.current.innerHTML = cached;
      return;
    }

    const id = `mermaid-${++mermaidCounter}`;
    let cancelled = false;
    mermaid
      .render(id, trimmed)
      .then(({ svg }) => {
        if (!cancelled && containerRef.current) {
          mermaidCache.set(trimmed, svg);
          containerRef.current.innerHTML = svg;
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(String(err));
        }
      });
    return () => {
      cancelled = true;
      const el = document.getElementById(id);
      if (el) el.remove();
    };
  }, [code]);

  const openOverlay = () => {
    const container = containerRef.current;
    if (!container) return;
    const svgEl = container.querySelector("svg");
    if (!svgEl) return;
    // Strip inline styles that may override Tailwind classes
    const clone = svgEl.cloneNode(true) as SVGElement;
    clone.removeAttribute("style");
    const svgHtml = clone.outerHTML;
    const viewBox = svgEl.getAttribute("viewBox");
    let svgW = parseFloat(svgEl.getAttribute("width") || "0") || 800;
    let svgH = parseFloat(svgEl.getAttribute("height") || "0") || 600;
    if (viewBox) {
      const parts = viewBox.split(/[\s,]+/).map(Number);
      if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
        svgW = parts[2];
        svgH = parts[3];
      }
    }
    const scale = 1;
    setOverlay({ svg: svgHtml, scale, x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!overlay) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setOverlay((prev) => prev ? { ...prev, scale: Math.max(0.1, Math.min(10, prev.scale * delta)) } : null);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!overlay) return;
    dragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, startLeft: overlay.x, startTop: overlay.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current.dragging || !overlay) return;
    setOverlay((prev) => prev ? {
      ...prev,
      x: dragRef.current.startLeft + (e.clientX - dragRef.current.startX),
      y: dragRef.current.startTop + (e.clientY - dragRef.current.startY),
    } : null);
  };

  const handleMouseUp = () => {
    dragRef.current.dragging = false;
  };

  if (error) {
    return (
      <pre className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200 overflow-auto">
        {error}
      </pre>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        className="overflow-x-auto my-2 [&>svg]:max-w-full cursor-pointer hover:opacity-90 transition-opacity"
        onClick={openOverlay}
        title="点击放大查看"
      />
      {overlay && (
        <div
          className="fixed inset-0 z-50 bg-gray-100 flex items-center justify-center"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div
            className="absolute top-4 right-4 flex items-center gap-3 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-muted-foreground text-sm">{Math.round(overlay.scale * 100)}%</span>
            <button
              className="text-muted-foreground hover:text-foreground text-lg px-2 py-1 bg-muted rounded"
              onClick={() => setOverlay((prev) => prev ? { ...prev, scale: prev.scale * 1.2 } : null)}
            >+</button>
            <button
              className="text-muted-foreground hover:text-foreground text-lg px-2 py-1 bg-muted rounded"
              onClick={() => setOverlay((prev) => prev ? { ...prev, scale: prev.scale / 1.2 } : null)}
            >−</button>
            <button
              className="text-muted-foreground hover:text-foreground text-lg px-2 py-1 bg-muted rounded"
              onClick={() => setOverlay((prev) => prev ? { ...prev, scale: 1, x: 0, y: 0 } : null)}
            >Reset</button>
            <button
              className="text-muted-foreground hover:text-foreground text-2xl px-2 py-1 bg-muted rounded leading-none"
              onClick={() => setOverlay(null)}
            >×</button>
          </div>
          <div
            className="cursor-grab active:cursor-grabbing [&>svg]:w-full [&>svg]:h-auto"
            style={{ transform: `translate(${overlay.x}px, ${overlay.y}px) scale(${overlay.scale})`, transformOrigin: "center center", transition: dragRef.current.dragging ? "none" : "transform 0.1s" }}
            dangerouslySetInnerHTML={{ __html: overlay.svg }}
            onClick={(e) => e.stopPropagation()}
          />
          <div
            className="absolute inset-0 -z-10"
            onClick={() => setOverlay(null)}
          />
        </div>
      )}
    </>
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

function CodeBlock({ className, children }: { className?: string; children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const text = extractText(children);
  const hasLang = /language-\w+/.test(className ?? "");

  const handleCopy = () => {
    navigator.clipboard.writeText(text.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!hasLang) {
    return (
      <code className="bg-muted text-foreground text-xs px-1.5 py-0.5 rounded font-mono whitespace-pre-wrap break-all">
        {children}
      </code>
    );
  }

  return (
    <div className="relative group">
      <pre className={className}>{children}</pre>
      <button
        className="absolute top-2 right-2 bg-white/10 text-gray-400 border-none rounded px-2 py-1 text-[11px] cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/20 hover:text-white"
        onClick={handleCopy}
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        pre({ children }) {
          return <>{children}</>;
        },
        code({ className, children }) {
          const match = className?.match(/language-(\w+)/);
          const lang = match?.[1] ?? "";
          if (lang === "mermaid") {
            return <MermaidBlock code={String(children).replace(/\n$/, "")} />;
          }
          return <CodeBlock className={className}>{children}</CodeBlock>;
        },
      }}
    >
      {content}
    </Markdown>
  );
}
