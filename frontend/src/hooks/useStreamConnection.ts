import { useEffect, useRef, useState } from "react";
import type { ChatMessage, ContentBlock, ImageAttachment, ResultInfo, PermissionRequest } from "../types";
import { sendChat, reconnectStream, checkActiveStream, interruptStream } from "../api";
import { useStreamEvents } from "./useStreamEvents";

interface UseStreamConnectionParams {
  taskId: string;
  sessionId: string | null;
  initialMessages: ChatMessage[];
  mode: "plan" | "code";
  onSessionIdChange: (id: string) => void;
  onStreamingChange: (streaming: boolean) => void;
}

interface UseStreamConnectionReturn {
  messages: ChatMessage[];
  streamContent: ContentBlock[];
  streaming: boolean;
  resultInfo: ResultInfo | null;
  pendingPermission: PermissionRequest | null;
  setPendingPermission: React.Dispatch<React.SetStateAction<PermissionRequest | null>>;
  send: (text: string, images?: ImageAttachment[]) => void;
  stop: () => Promise<void>;
  reconnecting: boolean;
}

export function useStreamConnection({
  taskId,
  sessionId,
  initialMessages,
  mode,
  onSessionIdChange,
  onStreamingChange,
}: UseStreamConnectionParams): UseStreamConnectionReturn {
  const abortRef = useRef<AbortController | null>(null);
  const activeTaskIdRef = useRef(taskId);
  activeTaskIdRef.current = taskId;
  const reconnectingTaskRef = useRef<string | null>(null);
  const streamEpochRef = useRef(0);
  const [reconnecting, setReconnecting] = useState(false);

  // Keep callbacks fresh to avoid stale closures
  const onStreamingChangeRef = useRef(onStreamingChange);
  onStreamingChangeRef.current = onStreamingChange;
  const onSessionIdChangeRef = useRef(onSessionIdChange);
  onSessionIdChangeRef.current = onSessionIdChange;

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
        onStreamingChangeRef.current(true);
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
            onStreamingChangeRef.current(false);
          }),
          guard(() => {
            reconnectingTaskRef.current = null;
            setStreaming(false);
            setReconnecting(false);
            onStreamingChangeRef.current(false);
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

  const send = (text: string, images?: ImageAttachment[]) => {
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

    abortRef.current?.abort();
    abortRef.current = null;
    streamEpochRef.current += 1;
    const epoch = streamEpochRef.current;

    resetStreamState();
    setStreaming(true);
    onStreamingChangeRef.current(true);

    const onEvent = (eventType: string, data: Record<string, unknown>) => {
      if (streamEpochRef.current !== epoch) return;
      if (activeTaskIdRef.current !== sendTaskId) return;
      if (eventType === "result" && data.session_id) {
        onSessionIdChangeRef.current(data.session_id as string);
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
        onStreamingChangeRef.current(false);
      },
      () => {
        if (streamEpochRef.current !== epoch) return;
        if (activeTaskIdRef.current !== sendTaskId) return;
        setStreaming(false);
        onStreamingChangeRef.current(false);
      },
      images
    );
  };

  const stop = async () => {
    await interruptStream(taskId);
    const final = accumulatedRef.current;
    if (final.length > 0) {
      setMessages((msgs) => [...msgs, { id: crypto.randomUUID(), role: "assistant", content: final }]);
    }
    accumulatedRef.current = [];
    resetStreamState();
    onStreamingChangeRef.current(false);
  };

  return {
    messages,
    streamContent,
    streaming,
    resultInfo,
    pendingPermission,
    setPendingPermission,
    send,
    stop,
    reconnecting,
  };
}
