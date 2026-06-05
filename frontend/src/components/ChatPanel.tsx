import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, ContentBlock, ImageAttachment } from "../types";
import { sendChat, reconnectStream, checkActiveStream, interruptStream, resolvePermission, fetchCommands } from "../api";
import type { SlashCommand as SlashCommandType } from "../api";
import { useStreamEvents } from "../hooks/useStreamEvents";
import { MessageBubble } from "./MessageBubble";
import { ResultInfoBar } from "./ResultInfoBar";
import { SlashCommandMenu, type SlashCommand } from "./SlashCommandMenu";
import { Button } from "@/components/ui/button";
import { PanelLeftClose, PanelLeftOpen, Paperclip, X } from "lucide-react";

interface Props {
  taskId: string;
  sessionId: string | null;
  initialMessages: ChatMessage[];
  onSessionIdChange: (id: string) => void;
  onStreamingChange: (streaming: boolean) => void;
  sidebarVisible: boolean;
  onToggleSidebar: () => void;
  planVisible: boolean;
  onTogglePlan: () => void;
  hasPlan: boolean;
  historyVisible: boolean;
  onToggleHistory: () => void;
  fileExplorerVisible: boolean;
  onToggleFileExplorer: () => void;
  hasFolder: boolean;
  folderPath: string | null;
}

function CopyButton({ getValue, label }: { getValue: () => string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-6 text-xs"
      onClick={() => {
        navigator.clipboard.writeText(getValue());
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copied!" : label}
    </Button>
  );
}

const VALID_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_IMAGES = 5;

function fileToAttachment(file: File): Promise<ImageAttachment> {
  return new Promise((resolve, reject) => {
    if (!VALID_IMAGE_TYPES.includes(file.type)) {
      reject(new Error(`Unsupported format: ${file.type}`));
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      reject(new Error(`File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB (max 10 MB)`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve({
        id: crypto.randomUUID(),
        base64: dataUrl.split(",")[1],
        mediaType: file.type,
        previewUrl: dataUrl,
        name: file.name || "clipboard.png",
      });
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function ChatPanel({ taskId, sessionId, initialMessages, onSessionIdChange, onStreamingChange, sidebarVisible, onToggleSidebar, planVisible, onTogglePlan, hasPlan, historyVisible, onToggleHistory, fileExplorerVisible, onToggleFileExplorer, hasFolder, folderPath }: Props) {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"plan" | "code">("code");
  const [reconnecting, setReconnecting] = useState(false);
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [slashCommands, setSlashCommands] = useState<SlashCommand[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeTaskIdRef = useRef(taskId);
  activeTaskIdRef.current = taskId;
  const reconnectingTaskRef = useRef<string | null>(null);

  const {
    messages,
    setMessages,
    streamContent,
    streaming,
    setStreaming,
    resultInfo,
    pendingPermission,
    setPendingPermission,
    accumulatedRef,
    handleEvent,
    resetStreamState,
  } = useStreamEvents();

  // Sync initialMessages into the hook
  useEffect(() => {
    // Don't disrupt an active SSE reconnection — it replays cached events
    // and handles message state itself. This prevents a race where
    // loadSession (returning [] for first conversations) aborts the reconnect.
    if (reconnectingTaskRef.current === taskId) {
      return;
    }
    abortRef.current?.abort();
    abortRef.current = null;
    resetStreamState();
    setMessages(initialMessages);
  }, [initialMessages, taskId]);

  // Reconnect to active stream on taskId change
  useEffect(() => {
    const currentTaskId = taskId;
    abortRef.current?.abort();
    abortRef.current = null;
    reconnectingTaskRef.current = null;

    let cancelled = false;
    checkActiveStream(taskId).then((res) => {
      if (cancelled) return;
      if (res.active) {
        reconnectingTaskRef.current = currentTaskId;
        setReconnecting(true);
        setStreaming(true);
        onStreamingChange(true);
        resetStreamState();
        setStreaming(true);

        const guard = <T extends unknown[]>(fn: (...args: T) => void) =>
          (...args: T) => {
            if (activeTaskIdRef.current !== currentTaskId) return;
            fn(...args);
          };

        abortRef.current = reconnectStream(
          taskId,
          guard(handleEvent),
          guard((err: Error) => {
            console.error("Reconnect error:", err);
            reconnectingTaskRef.current = null;
            setStreaming(false);
            setReconnecting(false);
            onStreamingChange(false);
          }),
          guard(() => {
            reconnectingTaskRef.current = null;
            setStreaming(false);
            setReconnecting(false);
            onStreamingChange(false);
          })
        );
      }
    });
    return () => {
      cancelled = true;
      reconnectingTaskRef.current = null;
      abortRef.current?.abort();
      abortRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  useEffect(() => {
    fetchCommands().then(setSlashCommands).catch(console.error);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, [messages, streamContent]);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 160) + "px";
    }
  }, [input]);

  const slashMenuPosition = useMemo(() => {
    const el = textareaRef.current;
    if (!el) return { top: 0, left: 42 };
    return { top: el.offsetTop, left: 42 };
  }, []);

  const handleInputChange = (value: string) => {
    setInput(value);
    if (value.startsWith("/")) {
      const spaceIdx = value.indexOf(" ");
      const query = spaceIdx === -1 ? value.slice(1) : "";
      if (spaceIdx === -1) {
        setSlashFilter(query);
        setSlashMenuOpen(true);
      } else {
        setSlashMenuOpen(false);
      }
    } else {
      setSlashMenuOpen(false);
    }
  };

  const handleSlashSelect = (cmd: SlashCommand) => {
    setInput(cmd.name + " ");
    setSlashMenuOpen(false);
    textareaRef.current?.focus();
  };

  const doSend = (text: string, images?: ImageAttachment[]) => {
    const sendTaskId = taskId;
    const content: ContentBlock[] = [];
    if (text.trim()) {
      content.push({ kind: "text", text });
    }
    for (const img of images ?? []) {
      content.push({
        kind: "image",
        source: { type: "base64", media_type: img.mediaType, data: img.base64 },
        text: img.name,
      });
    }
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content };
    setMessages((prev) => [...prev, userMsg]);
    resetStreamState();
    setStreaming(true);
    onStreamingChange(true);

    const onEvent = (eventType: string, data: Record<string, unknown>) => {
      if (activeTaskIdRef.current !== sendTaskId) return;
      if (eventType === "result" && data.session_id) {
        onSessionIdChange(data.session_id as string);
      }
      handleEvent(eventType, data);
    };

    abortRef.current = sendChat(
      taskId,
      text,
      sessionId,
      mode,
      onEvent,
      (err) => {
        if (activeTaskIdRef.current !== sendTaskId) return;
        console.error(err);
        setStreaming(false);
        onStreamingChange(false);
      },
      () => {
        if (activeTaskIdRef.current !== sendTaskId) return;
        setStreaming(false);
        onStreamingChange(false);
      },
      images
    );
  };

  const doSendRef = useRef(doSend);
  doSendRef.current = doSend;

  const handleSelectOption = useCallback((text: string) => {
    doSendRef.current(text);
  }, []);

  const stableOnSelectOption = !streaming ? handleSelectOption : undefined;

  const handleSend = () => {
    if (streaming) return;
    if (!input.trim() && attachments.length === 0) return;
    const text = input;
    const images = [...attachments];
    setInput("");
    setAttachments([]);
    doSend(text, images);
  };

  const handleStop = async () => {
    await interruptStream(taskId);
    const final = accumulatedRef.current;
    if (final.length > 0) {
      setMessages((msgs) => [...msgs, { id: crypto.randomUUID(), role: "assistant", content: final }]);
    }
    accumulatedRef.current = [];
    resetStreamState();
    onStreamingChange(false);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      const newAttachments = await Promise.all(imageFiles.map(fileToAttachment));
      setAttachments((prev) => [...prev, ...newAttachments].slice(0, MAX_IMAGES));
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const newAttachments = await Promise.all(files.map(fileToAttachment));
    setAttachments((prev) => [...prev, ...newAttachments].slice(0, MAX_IMAGES));
    e.target.value = "";
  };

  const canSend = !streaming && (input.trim() || attachments.length > 0);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header bar */}
      <div className="px-4 h-12 border-b flex items-center shrink-0 gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="h-6 w-6 mr-1"
          title={sidebarVisible ? "收起侧边栏" : "展开侧边栏"}
        >
          {sidebarVisible ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </Button>
        {hasPlan && (
          <Button
            variant={planVisible ? "default" : "outline"}
            size="sm"
            onClick={onTogglePlan}
            className="h-6 text-xs"
          >
            Plan
          </Button>
        )}
        {hasFolder && (
          <Button
            variant={fileExplorerVisible ? "default" : "outline"}
            size="sm"
            onClick={onToggleFileExplorer}
            className="h-6 text-xs"
          >
            Files
          </Button>
        )}
        {sessionId && (
          <Button
            variant={historyVisible ? "default" : "outline"}
            size="sm"
            onClick={onToggleHistory}
            className="h-6 text-xs"
          >
            History
          </Button>
        )}
        {sessionId && (
          <CopyButton
            getValue={() => {
              return folderPath
                ? `cd ${folderPath} && claude --resume ${sessionId}`
                : `claude --resume ${sessionId}`;
            }}
            label="CLI"
          />
        )}
        <div className="flex-1" />
        <div className="flex justify-center min-w-0">
          {folderPath && (
            <span className="text-xs text-muted-foreground font-mono truncate max-w-[50vw]" title={folderPath}>
              {folderPath}
            </span>
          )}
        </div>
        <div className="flex-1" />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-3xl mx-auto px-6 py-6 pb-4">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onSelectOption={stableOnSelectOption}
            />
          ))}
          {streaming && streamContent.length > 0 && (
            <MessageBubble
              message={{ role: "assistant", content: streamContent }}
              isStreaming
            />
          )}
          {streaming && streamContent.length === 0 && (
            <div className="flex gap-1.5 pl-[46px] py-2 items-center">
              {reconnecting && (
                <span className="text-xs text-muted-foreground mr-2">Reconnecting...</span>
              )}
              <div className="w-[7px] h-[7px] rounded-full bg-muted-foreground/60" style={{ animation: "chatBounce 1.4s infinite ease-in-out" }} />
              <div className="w-[7px] h-[7px] rounded-full bg-muted-foreground/60" style={{ animation: "chatBounce 1.4s infinite ease-in-out 0.16s" }} />
              <div className="w-[7px] h-[7px] rounded-full bg-muted-foreground/60" style={{ animation: "chatBounce 1.4s infinite ease-in-out 0.32s" }} />
            </div>
          )}
          {streaming && pendingPermission && (
            <div className="mt-2.5 p-3 border border-amber-500 rounded-xl bg-amber-50">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold">!</span>
                <span>{pendingPermission.title || `${pendingPermission.tool_name} permission`}</span>
              </div>
              {pendingPermission.description && (
                <div className="mt-1.5 text-[13px] text-amber-800">{pendingPermission.description}</div>
              )}
              {pendingPermission.blocked_path && (
                <div className="mt-1 text-xs font-mono text-amber-900 bg-amber-100 px-2 py-1 rounded">
                  {pendingPermission.blocked_path}
                </div>
              )}
              <div className="mt-2.5 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-emerald-500 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 font-semibold"
                  onClick={async () => {
                    try {
                      await resolvePermission(taskId, pendingPermission.request_id, "allow");
                    } catch { /* ignore */ }
                    setPendingPermission(null);
                  }}
                >
                  Allow
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-500 bg-red-50 text-red-900 hover:bg-red-100 font-semibold"
                  onClick={async () => {
                    try {
                      await resolvePermission(taskId, pendingPermission.request_id, "deny");
                    } catch { /* ignore */ }
                    setPendingPermission(null);
                  }}
                >
                  Deny
                </Button>
              </div>
            </div>
          )}
          {!streaming && resultInfo && <ResultInfoBar info={resultInfo} />}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="px-6 pb-6 flex justify-center items-end shrink-0 gap-5">
        <div className="flex rounded-full overflow-hidden border border-border bg-muted shrink-0 self-center">
          <button
            className={`px-3.5 py-1.5 text-[13px] border-none cursor-pointer transition-colors ${
              mode === "plan" ? "bg-orange-500 text-white font-semibold" : "bg-transparent text-muted-foreground"
            } ${streaming ? "opacity-60 cursor-default" : ""}`}
            onClick={() => setMode("plan")}
            disabled={streaming}
          >
            Plan
          </button>
          <button
            className={`px-3.5 py-1.5 text-[13px] border-none cursor-pointer transition-colors ${
              mode === "code" ? "bg-primary text-primary-foreground font-semibold" : "bg-transparent text-muted-foreground"
            } ${streaming ? "opacity-60 cursor-default" : ""}`}
            onClick={() => setMode("code")}
            disabled={streaming}
          >
            Code
          </button>
        </div>
        <div className="max-w-3xl w-full relative">
          {/* Image preview */}
          {attachments.length > 0 && (
            <div className="flex gap-2 mb-2 flex-wrap">
              {attachments.map((att) => (
                <div key={att.id} className="relative group">
                  <img
                    src={att.previewUrl}
                    alt={att.name}
                    className="w-16 h-16 object-cover rounded-lg border border-border"
                  />
                  <button
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />

          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onPaste={handlePaste}
            onBlur={() => setTimeout(() => setSlashMenuOpen(false), 150)}
            onKeyDown={(e) => {
              if (slashMenuOpen) return;
              if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Message... (type / for commands, Shift+Enter for new line)"
            className="w-full py-3.5 pl-[42px] pr-[52px] rounded-3xl border border-input text-[15px] resize-none outline-none leading-relaxed min-h-[48px] max-h-[160px] overflow-hidden shadow-sm transition-[border-color,box-shadow] focus:border-primary focus:shadow-[0_2px_12px_rgba(25,118,210,0.12)] disabled:bg-muted/50 disabled:opacity-70 placeholder:text-muted-foreground/50"
          />

          {slashMenuOpen && (
            <SlashCommandMenu
              commands={slashCommands}
              filter={slashFilter}
              position={slashMenuPosition}
              onSelect={handleSlashSelect}
              onClose={() => setSlashMenuOpen(false)}
            />
          )}

          {/* Attach button */}
          <button
            className="absolute left-2 top-[calc(50%-4px)] -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            disabled={streaming}
            title="Attach image"
          >
            <Paperclip size={18} />
          </button>

          {streaming && (
            <button
              className="absolute right-12 top-[calc(50%-4px)] -translate-y-1/2 w-9 h-9 rounded-full bg-background border border-destructive text-destructive flex items-center justify-center cursor-pointer transition-colors hover:bg-destructive/10"
              onClick={handleStop}
              title="Stop"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
          )}
          <button
            className={`absolute right-2 top-[calc(50%-4px)] -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
              !canSend
                ? "bg-muted text-muted-foreground cursor-default"
                : "bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90 active:scale-95"
            }`}
            onClick={handleSend}
            disabled={!canSend}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
