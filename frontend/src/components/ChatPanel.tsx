import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, ContentBlock } from "../types";
import { sendChat, reconnectStream, checkActiveStream, interruptStream } from "../api";
import { useStreamEvents } from "../hooks/useStreamEvents";
import { useImageAttachments } from "../hooks/useImageAttachments";
import { useSlashCommands } from "../hooks/useSlashCommands";
import { useLayout } from "../hooks/useLayout";
import { MessageBubble } from "./MessageBubble";
import { ResultInfoBar } from "./ResultInfoBar";
import { PermissionRequestDialog } from "./PermissionRequestDialog";
import { ChatInput } from "./ChatInput";
import { Button } from "@/components/ui/button";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

interface Props {
  taskId: string;
  sessionId: string | null;
  initialMessages: ChatMessage[];
  onSessionIdChange: (id: string) => void;
  onStreamingChange: (streaming: boolean) => void;
  hasPlan: boolean;
  hasFolder: boolean;
  folderPath: string | null;
}

export function ChatPanel({ taskId, sessionId, initialMessages, onSessionIdChange, onStreamingChange, hasPlan, hasFolder, folderPath }: Props) {
  const layout = useLayout();
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"plan" | "code">("code");
  const [reconnecting, setReconnecting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeTaskIdRef = useRef(taskId);
  activeTaskIdRef.current = taskId;
  const reconnectingTaskRef = useRef<string | null>(null);
  // Monotonically increasing epoch — incremented on every stream reset so
  // stale SSE callbacks (from the same task but a previous stream) are dropped.
  const streamEpochRef = useRef(0);

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

  const {
    attachments,
    fileInputRef,
    handlePaste,
    handleFileSelect,
    removeAttachment,
    clearAttachments,
  } = useImageAttachments();

  const {
    slashMenuOpen,
    setSlashMenuOpen,
    slashFilter,
    slashCommands,
    handleInputChange: handleSlashInputChange,
  } = useSlashCommands();

  // Sync initialMessages into the hook
  useEffect(() => {
    if (reconnectingTaskRef.current === taskId) {
      return;
    }
    abortRef.current?.abort();
    abortRef.current = null;
    streamEpochRef.current += 1;
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
        streamEpochRef.current += 1;
        const epoch = streamEpochRef.current;
        setReconnecting(true);
        setStreaming(true);
        onStreamingChange(true);
        resetStreamState();
        setStreaming(true);

        const guard = <T extends unknown[]>(fn: (...args: T) => void) =>
          (...args: T) => {
            if (streamEpochRef.current !== epoch) return;
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
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, [messages, streamContent]);

  const doSend = (text: string, images?: typeof attachments) => {
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

    // Abort any previous stream and bump epoch so stale callbacks are ignored
    abortRef.current?.abort();
    abortRef.current = null;
    streamEpochRef.current += 1;
    const epoch = streamEpochRef.current;

    resetStreamState();
    setStreaming(true);
    onStreamingChange(true);

    const onEvent = (eventType: string, data: Record<string, unknown>) => {
      if (streamEpochRef.current !== epoch) return;
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
        if (streamEpochRef.current !== epoch) return;
        if (activeTaskIdRef.current !== sendTaskId) return;
        console.error(err);
        setStreaming(false);
        onStreamingChange(false);
      },
      () => {
        if (streamEpochRef.current !== epoch) return;
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
    clearAttachments();
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

  const canSend = !streaming && (input.trim() || attachments.length > 0);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header bar */}
      <div className="px-4 h-12 border-b flex items-center shrink-0 gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={layout.toggleSidebar}
          className="h-6 w-6 mr-1"
          title={layout.sidebarVisible ? "收起侧边栏" : "展开侧边栏"}
        >
          {layout.sidebarVisible ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </Button>
        {hasPlan && (
          <Button
            variant={layout.planVisible ? "default" : "outline"}
            size="sm"
            onClick={layout.togglePlan}
            className="h-6 text-xs"
          >
            Plan
          </Button>
        )}
        {hasFolder && (
          <Button
            variant={layout.fileExplorerVisible ? "default" : "outline"}
            size="sm"
            onClick={layout.toggleFileExplorer}
            className="h-6 text-xs"
          >
            Files
          </Button>
        )}
        {sessionId && (
          <Button
            variant={layout.historyVisible ? "default" : "outline"}
            size="sm"
            onClick={layout.toggleHistory}
            className="h-6 text-xs"
          >
            History
          </Button>
        )}
        {sessionId && (
          <Button
            variant={layout.terminalVisible ? "default" : "outline"}
            size="sm"
            className="h-6 text-xs"
            onClick={layout.toggleTerminal}
          >
            Terminal
          </Button>
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
            <PermissionRequestDialog
              taskId={taskId}
              permission={pendingPermission}
              onDismiss={() => setPendingPermission(null)}
            />
          )}
          {!streaming && resultInfo && <ResultInfoBar info={resultInfo} />}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <ChatInput
        input={input}
        setInput={setInput}
        streaming={streaming}
        mode={mode}
        setMode={setMode}
        attachments={attachments}
        onRemoveAttachment={removeAttachment}
        onPaste={handlePaste}
        onFileSelect={handleFileSelect}
        fileInputRef={fileInputRef}
        onSend={handleSend}
        onStop={handleStop}
        canSend={canSend}
        slashMenuOpen={slashMenuOpen}
        setSlashMenuOpen={setSlashMenuOpen}
        slashFilter={slashFilter}
        slashCommands={slashCommands}
        onSlashInputChange={handleSlashInputChange}
      />
    </div>
  );
}
