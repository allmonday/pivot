import { useCallback, useRef, useState } from "react";
import type { ChatMessage, ContentBlock, ResultInfo, PermissionRequest } from "../types";

interface UseStreamEventsReturn {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  streamContent: ContentBlock[];
  streaming: boolean;
  setStreaming: (v: boolean) => void;
  resultInfo: ResultInfo | null;
  pendingPermission: PermissionRequest | null;
  setPendingPermission: React.Dispatch<React.SetStateAction<PermissionRequest | null>>;
  accumulatedRef: React.MutableRefObject<ContentBlock[]>;
  handleEvent: (eventType: string, data: Record<string, unknown>) => void;
  handleStreamEnd: (onSessionIdChange: (id: string) => void, onStreamingChange: (v: boolean) => void) => void;
  resetStreamState: () => void;
}

export function useStreamEvents(): UseStreamEventsReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamContent, setStreamContent] = useState<ContentBlock[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [resultInfo, setResultInfo] = useState<ResultInfo | null>(null);
  const [pendingPermission, setPendingPermission] = useState<PermissionRequest | null>(null);
  const accumulatedRef = useRef<ContentBlock[]>([]);

  const handleEvent = useCallback((eventType: string, data: Record<string, unknown>) => {
    if (eventType === "assistant") {
      const content = (data.content as ContentBlock[]).filter(
        (b) => b.kind !== "thinking"
      );
      accumulatedRef.current = [...accumulatedRef.current, ...content];
      setStreamContent([...accumulatedRef.current]);
    }
    if (eventType === "result") {
      setResultInfo({
        total_cost_usd: (data.total_cost_usd as number) ?? null,
        duration_ms: (data.duration_ms as number) ?? null,
        duration_api_ms: (data.duration_api_ms as number) ?? null,
        num_turns: (data.num_turns as number) ?? null,
      });
      setPendingPermission(null);
      const final = accumulatedRef.current;
      if (final.length > 0) {
        setMessages((msgs) => [...msgs, { id: crypto.randomUUID(), role: "assistant", content: final }]);
      }
      accumulatedRef.current = [];
      setStreamContent([]);
      setStreaming(false);
    }
    if (eventType === "error") {
      setMessages((msgs) => [
        ...msgs,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: [{ kind: "text", text: `Error: ${data.message}` }],
        },
      ]);
      setStreaming(false);
    }
    if (eventType === "permission_request") {
      setPendingPermission(data as unknown as PermissionRequest);
    }
  }, []);

  const handleStreamEnd = useCallback((onSessionIdChange: (id: string) => void, onStreamingChange: (v: boolean) => void) => {
    setStreaming(false);
    onStreamingChange(false);
  }, []);

  const resetStreamState = useCallback(() => {
    setStreaming(false);
    setStreamContent([]);
    accumulatedRef.current = [];
    setResultInfo(null);
    setPendingPermission(null);
  }, []);

  return {
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
    handleStreamEnd,
    resetStreamState,
  };
}
