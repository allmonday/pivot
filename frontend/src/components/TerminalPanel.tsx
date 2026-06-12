import { useEffect, useRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { X } from "lucide-react";

const WS_BASE = `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/api/ws/terminal`;

interface Props {
  taskId: string;
  folderPath: string | null;
  visible: boolean;
  onClose: () => void;
  height: number;
}

export function TerminalPanel({ taskId, folderPath, visible, onClose, height }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const termInitedRef = useRef(false);

  // Initialize xterm.js when first becoming visible
  useEffect(() => {
    if (!visible || termInitedRef.current || !containerRef.current) return;
    termInitedRef.current = true;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'SF Mono', 'Menlo', 'Courier New', monospace",
      theme: {
        background: "#1e1e1e",
        foreground: "#d4d4d4",
        cursor: "#d4d4d4",
        cursorAccent: "#1e1e1e",
        selectionBackground: "#264f78",
        black: "#000000",
        red: "#cd3131",
        green: "#0dbc79",
        yellow: "#e5e510",
        blue: "#2472c8",
        magenta: "#bc3fbc",
        cyan: "#11a8cd",
        white: "#e5e5e5",
        brightBlack: "#666666",
        brightRed: "#f14c4c",
        brightGreen: "#23d18b",
        brightYellow: "#f5f543",
        brightBlue: "#3b8eea",
        brightMagenta: "#d670d6",
        brightCyan: "#29b8db",
        brightWhite: "#ffffff",
      },
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Wire up user input
    term.onData((data) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "input", data }));
      }
    });

    // Wait for fonts then fit
    document.fonts.ready.then(() => {
      fitAddon.fit();
    });
  }, [visible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close();
      if (termRef.current) {
        termRef.current.dispose();
      }
      termRef.current = null;
      fitAddonRef.current = null;
      wsRef.current = null;
      termInitedRef.current = false;
    };
  }, []);

  const connect = useCallback(() => {
    if (!folderPath) return;

    wsRef.current?.close();
    wsRef.current = null;

    const cwd = encodeURIComponent(folderPath);
    const ws = new WebSocket(`${WS_BASE}/${taskId}?cwd=${cwd}`);
    wsRef.current = ws;

    ws.onopen = () => {
      const dims = fitAddonRef.current?.proposeDimensions();
      if (dims && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols: dims.cols, rows: dims.rows }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "output" && termRef.current) {
          const bytes = Uint8Array.from(atob(msg.data), (c) => c.charCodeAt(0));
          termRef.current.write(bytes);
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      // Only write if this is still the active connection
      if (wsRef.current === ws && termRef.current) {
        termRef.current.write("\r\n\x1b[33m[Connection closed]\x1b[0m\r\n");
      }
    };

    ws.onerror = () => {
      if (wsRef.current === ws && termRef.current) {
        termRef.current.write("\r\n\x1b[31m[Connection error]\x1b[0m\r\n");
      }
    };
  }, [taskId, folderPath]);

  // Connect / reconnect on taskId or folderPath change
  useEffect(() => {
    if (!visible || !termInitedRef.current) return;
    connect();
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
      if (termRef.current) {
        termRef.current.clear();
      }
    };
  }, [taskId, folderPath, visible, connect]);

  // Fit when visibility or height changes
  useEffect(() => {
    if (!visible || !fitAddonRef.current) return;
    const timer = setTimeout(() => {
      fitAddonRef.current?.fit();
    }, 50);
    return () => clearTimeout(timer);
  }, [visible, height]);

  const folderName = folderPath?.split("/").pop() ?? "~";

  return (
    <div
      className="border-t border-border flex flex-col bg-[#1e1e1e] shrink-0"
      style={{ height: visible ? height : 0, overflow: "hidden" }}
    >
      <div className="px-3 py-1 border-b border-white/10 flex items-center bg-[#252526] shrink-0">
        <span className="text-[12px] text-gray-400 font-mono">
          TERMINAL: {folderName}
        </span>
        <div className="flex-1" />
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-300 transition-colors"
          title="Close terminal"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div ref={containerRef} className="flex-1 min-h-0 px-1" />
    </div>
  );
}
