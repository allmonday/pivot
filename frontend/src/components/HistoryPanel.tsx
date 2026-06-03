import { useEffect, useState } from "react";
import type { ChatMessage } from "../types";
import { fetchFullHistory } from "../api";
import { MessageBubble } from "./MessageBubble";
import { X } from "lucide-react";

interface Props {
  taskId: string;
  visible: boolean;
  onClose: () => void;
  width: number;
}

export function HistoryPanel({ taskId, visible, onClose, width }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !taskId) return;
    setLoading(true);
    setError(null);
    fetchFullHistory(taskId)
      .then((data) => {
        setMessages(data);
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load history");
        setLoading(false);
      });
  }, [visible, taskId]);

  if (!visible) return null;

  return (
    <div
      className="border-l border-border flex flex-col bg-muted/50 shrink-0"
      style={{ width }}
    >
      <div className="px-3 py-2 border-b border-border flex justify-between items-center bg-background">
        <span className="text-[13px] font-semibold text-foreground">Full History</span>
        <X
          className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
          onClick={onClose}
        />
      </div>

      <div className="flex-1 overflow-auto px-4 py-3 scrollbar-thin">
        {loading ? (
          <div className="text-muted-foreground text-[13px]">Loading...</div>
        ) : error ? (
          <div className="text-destructive text-[13px]">{error}</div>
        ) : messages.length === 0 ? (
          <div className="text-muted-foreground text-[13px]">No history available</div>
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))
        )}
      </div>
    </div>
  );
}
