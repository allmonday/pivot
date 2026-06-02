import { useEffect, useRef, useState } from "react";
import type { ChatMessage, ContentBlock } from "../types";
import { sendChat, reconnectStream, checkActiveStream } from "../api";
import { MessageBubble } from "./MessageBubble";
import "./chat.css";

interface Props {
  taskId: string;
  sessionId: string | null;
  initialMessages: ChatMessage[];
  onSessionIdChange: (id: string) => void;
  onStreamingChange: (streaming: boolean) => void;
  planVisible: boolean;
  onTogglePlan: () => void;
  hasPlan: boolean;
}

export function ChatPanel({ taskId, sessionId, initialMessages, onSessionIdChange, onStreamingChange, planVisible, onTogglePlan, hasPlan }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState<ContentBlock[]>([]);
  const [mode, setMode] = useState<"plan" | "code">("code");
  const [reconnecting, setReconnecting] = useState(false);
  const accumulatedRef = useRef<ContentBlock[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // sync when parent passes new initialMessages (task switch)
  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    setStreamContent([]);
    accumulatedRef.current = [];
    setMessages(initialMessages);
  }, [initialMessages]);

  // mount 时检查是否有活跃流可以重连
  useEffect(() => {
    let cancelled = false;
    checkActiveStream(taskId).then((res) => {
      if (cancelled) return;
      if (res.active && res.stream_id) {
        // 有活跃流，开始重连
        setReconnecting(true);
        setStreaming(true);
        onStreamingChange(true);
        setStreamContent([]);
        accumulatedRef.current = [];

        abortRef.current = reconnectStream(
          res.stream_id,
          (eventType, data) => {
            if (eventType === "assistant") {
              const content = (data.content as ContentBlock[]).filter(
                (b) => b.kind !== "thinking"
              );
              accumulatedRef.current = [...accumulatedRef.current, ...content];
              setStreamContent([...accumulatedRef.current]);
            }
            if (eventType === "result") {
              if (data.session_id) {
                onSessionIdChange(data.session_id as string);
              }
              const final = accumulatedRef.current;
              if (final.length > 0) {
                setMessages((msgs) => [...msgs, { role: "assistant", content: final }]);
              }
              accumulatedRef.current = [];
              setStreamContent([]);
              setStreaming(false);
              setReconnecting(false);
              onStreamingChange(false);
            }
            if (eventType === "error") {
              setMessages((msgs) => [
                ...msgs,
                {
                  role: "assistant",
                  content: [{ kind: "text", text: `Error: ${data.message}` }],
                },
              ]);
              setStreaming(false);
              setReconnecting(false);
              onStreamingChange(false);
            }
          },
          (err) => {
            console.error("Reconnect error:", err);
            setStreaming(false);
            setReconnecting(false);
            onStreamingChange(false);
          },
          () => {
            setStreaming(false);
            setReconnecting(false);
            onStreamingChange(false);
          }
        );
      }
    });
    return () => {
      cancelled = true;
    };
    // 仅在 mount 时执行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  // auto-scroll to bottom when new content arrives
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamContent]);

  // auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 160) + "px";
    }
  }, [input]);

  const doSend = (text: string) => {
    const userMsg: ChatMessage = {
      role: "user",
      content: [{ kind: "text", text }],
    };
    setMessages((prev) => [...prev, userMsg]);
    setStreaming(true);
    onStreamingChange(true);
    setStreamContent([]);
    accumulatedRef.current = [];

    abortRef.current = sendChat(
      taskId,
      text,
      sessionId,
      mode,
      (eventType, data) => {
        if (eventType === "assistant") {
          const content = (data.content as ContentBlock[]).filter(
            (b) => b.kind !== "thinking"
          );
          accumulatedRef.current = [...accumulatedRef.current, ...content];
          setStreamContent([...accumulatedRef.current]);
        }
        if (eventType === "result") {
          if (data.session_id) {
            onSessionIdChange(data.session_id as string);
          }
          const final = accumulatedRef.current;
          if (final.length > 0) {
            setMessages((msgs) => [...msgs, { role: "assistant", content: final }]);
          }
          accumulatedRef.current = [];
          setStreamContent([]);
          setStreaming(false);
          onStreamingChange(false);
        }
        if (eventType === "error") {
          setMessages((msgs) => [
            ...msgs,
            {
              role: "assistant",
              content: [{ kind: "text", text: `Error: ${data.message}` }],
            },
          ]);
          setStreaming(false);
          onStreamingChange(false);
        }
      },
      (err) => {
        console.error(err);
        setStreaming(false);
        onStreamingChange(false);
      },
      () => {
        setStreaming(false);
        onStreamingChange(false);
      }
    );
  };

  const handleSend = () => {
    if (!input.trim() || streaming) return;
    const text = input;
    setInput("");
    doSend(text);
  };

  return (
    <div className="chat-panel">
      {/* Header bar */}
      <div className="chat-header">
        <div className="chat-mode-toggle">
          <button
            className={`chat-mode-btn ${mode === "plan" ? "chat-mode-btn--active-plan" : ""}`}
            onClick={() => setMode("plan")}
            disabled={streaming}
          >
            Plan
          </button>
          <button
            className={`chat-mode-btn ${mode === "code" ? "chat-mode-btn--active-code" : ""}`}
            onClick={() => setMode("code")}
            disabled={streaming}
          >
            Code
          </button>
        </div>
        <span className="chat-session-id">
          session: {sessionId ? sessionId.slice(0, 8) + "..." : "new"}
        </span>
        {hasPlan && (
          <button
            onClick={onTogglePlan}
            style={{
              marginLeft: 8,
              padding: "2px 8px",
              border: planVisible ? "1px solid #1976d2" : "1px solid #ddd",
              borderRadius: 4,
              background: planVisible ? "#e3f2fd" : "#fff",
              color: planVisible ? "#1976d2" : "#666",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Plan
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="chat-messages">
        <div className="chat-messages-inner">
          {messages.map((msg, i) => (
            <MessageBubble
              key={i}
              message={msg}
              onSelectOption={!streaming ? doSend : undefined}
            />
          ))}
          {streaming && streamContent.length > 0 && (
            <MessageBubble
              message={{ role: "assistant", content: streamContent }}
              isStreaming
            />
          )}
          {streaming && streamContent.length === 0 && (
            <div className="chat-typing">
              {reconnecting && (
                <span style={{ fontSize: 12, color: "#888", marginRight: 8 }}>
                  Reconnecting...
                </span>
              )}
              <div className="chat-typing-dot" />
              <div className="chat-typing-dot" />
              <div className="chat-typing-dot" />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <div className="chat-input-wrapper">
          <textarea
            ref={textareaRef}
            className="chat-input"
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Message... (Shift+Enter for new line)"
          />
          <button
            className="chat-send-btn"
            onClick={handleSend}
            disabled={streaming || !input.trim()}
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
