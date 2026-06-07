import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../types";
import { useStreamConnection } from "../hooks/useStreamConnection";
import { useImageAttachments } from "../hooks/useImageAttachments";
import { useSlashCommands } from "../hooks/useSlashCommands";
import { useLayout } from "../hooks/useLayout";
import { MessageBubble } from "./MessageBubble";
import { ResultInfoBar } from "./ResultInfoBar";
import { PermissionRequestDialog } from "./PermissionRequestDialog";
import { ChatInput } from "./ChatInput";
import { Button } from "@/components/ui/button";
import { PanelLeftClose, PanelLeftOpen, Maximize2, Minimize2 } from "lucide-react";

interface Props {
  taskId: string;
  sessionId: string | null;
  initialMessages: ChatMessage[];
  onSessionIdChange: (id: string) => void;
  onStreamingChange: (streaming: boolean) => void;
  hasPlan: boolean;
  hasFolder: boolean;
  hasCompact: boolean;
  folderPath: string | null;
}

export function ChatPanel({ taskId, sessionId, initialMessages, onSessionIdChange, onStreamingChange, hasPlan, hasFolder, hasCompact, folderPath }: Props) {
  const layout = useLayout();
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"plan" | "code">("code");
  const [fullWidth, setFullWidth] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const conn = useStreamConnection({
    taskId,
    sessionId,
    initialMessages,
    mode,
    onSessionIdChange,
    onStreamingChange,
  });

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, [conn.messages, conn.streamContent]);

  const sendRef = useRef(conn.send);
  sendRef.current = conn.send;

  const handleSelectOption = useCallback((text: string) => {
    sendRef.current(text);
  }, []);

  const stableOnSelectOption = !conn.streaming ? handleSelectOption : undefined;

  const handleSend = () => {
    if (conn.streaming) return;
    if (!input.trim() && attachments.length === 0) return;
    const text = input;
    const images = [...attachments];
    setInput("");
    clearAttachments();
    conn.send(text, images);
  };

  const canSend = !conn.streaming && (input.trim() || attachments.length > 0);

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
        {hasCompact && (
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
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setFullWidth((v) => !v)}
          title={fullWidth ? "居中模式" : "全宽模式"}
        >
          {fullWidth ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className={`${fullWidth ? "max-w-6xl mx-auto" : "max-w-3xl mx-auto"} px-6 py-6 pb-4`}>
          {conn.messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onSelectOption={stableOnSelectOption}
            />
          ))}
          {conn.streaming && conn.streamContent.length > 0 && (
            <MessageBubble
              message={{ role: "assistant", content: conn.streamContent }}
              isStreaming
            />
          )}
          {conn.streaming && conn.streamContent.length === 0 && (
            <div className="flex gap-1.5 pl-[46px] py-2 items-center">
              {conn.reconnecting && (
                <span className="text-xs text-muted-foreground mr-2">Reconnecting...</span>
              )}
              <div className="w-[7px] h-[7px] rounded-full bg-muted-foreground/60" style={{ animation: "chatBounce 1.4s infinite ease-in-out" }} />
              <div className="w-[7px] h-[7px] rounded-full bg-muted-foreground/60" style={{ animation: "chatBounce 1.4s infinite ease-in-out 0.16s" }} />
              <div className="w-[7px] h-[7px] rounded-full bg-muted-foreground/60" style={{ animation: "chatBounce 1.4s infinite ease-in-out 0.32s" }} />
            </div>
          )}
          {conn.streaming && conn.pendingPermission && (
            <PermissionRequestDialog
              taskId={taskId}
              permission={conn.pendingPermission}
              onDismiss={() => conn.setPendingPermission(null)}
            />
          )}
          {!conn.streaming && conn.resultInfo && <ResultInfoBar info={conn.resultInfo} />}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <ChatInput
        input={input}
        setInput={setInput}
        streaming={conn.streaming}
        mode={mode}
        setMode={setMode}
        fullWidth={fullWidth}
        attachments={attachments}
        onRemoveAttachment={removeAttachment}
        onPaste={handlePaste}
        onFileSelect={handleFileSelect}
        fileInputRef={fileInputRef}
        onSend={handleSend}
        onStop={conn.stop}
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
