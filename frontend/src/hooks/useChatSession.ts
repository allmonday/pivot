import { useRef, useState } from "react";
import type { ChatMessage } from "../types";
import { fetchSession, fetchMessages } from "../api";

export function useChatSession() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<ChatMessage[]>([]);
  const activeTaskIdRef = useRef<string | null>(null);

  const loadSession = async (taskId: string) => {
    activeTaskIdRef.current = taskId;
    const [existing, history] = await Promise.all([
      fetchSession(taskId).catch(() => null),
      fetchMessages(taskId).catch(() => []),
    ]);
    if (activeTaskIdRef.current !== taskId) return;
    setSessionId(existing);
    setInitialMessages(history);
  };

  const resetSession = () => {
    setSessionId(null);
    setInitialMessages([]);
  };

  return {
    sessionId,
    setSessionId,
    initialMessages,
    setInitialMessages,
    loadSession,
    resetSession,
  };
}
