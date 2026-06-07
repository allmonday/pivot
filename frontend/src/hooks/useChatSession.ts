import { useRef, useState } from "react";
import type { ChatMessage } from "../types";
import { fetchSession, fetchMessages, checkHasCompact } from "../api";

export function useChatSession() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<ChatMessage[]>([]);
  const [hasCompact, setHasCompact] = useState(false);
  const activeTaskIdRef = useRef<string | null>(null);

  const loadSession = async (taskId: string) => {
    activeTaskIdRef.current = taskId;
    const [existing, history, compact] = await Promise.all([
      fetchSession(taskId).catch(() => null),
      fetchMessages(taskId).catch(() => []),
      checkHasCompact(taskId).catch(() => false),
    ]);
    if (activeTaskIdRef.current !== taskId) return;
    setSessionId(existing);
    setInitialMessages(history);
    setHasCompact(compact);
  };

  const resetSession = () => {
    setSessionId(null);
    setInitialMessages([]);
    setHasCompact(false);
  };

  return {
    sessionId,
    setSessionId,
    initialMessages,
    setInitialMessages,
    hasCompact,
    loadSession,
    resetSession,
  };
}
