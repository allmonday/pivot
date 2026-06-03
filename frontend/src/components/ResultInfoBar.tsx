import type { ResultInfo } from "../types";

interface Props {
  info: ResultInfo;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainSeconds = seconds % 60;
  return `${minutes}m ${remainSeconds}s`;
}

export function ResultInfoBar({ info }: Props) {
  return (
    <div className="flex gap-4 px-4 py-2 mt-1 bg-muted/50 rounded-lg text-xs text-muted-foreground">
      {info.total_cost_usd != null && (
        <span>Cost: ${info.total_cost_usd.toFixed(4)}</span>
      )}
      {info.duration_ms != null && (
        <span>Duration: {formatDuration(info.duration_ms)}</span>
      )}
      {info.num_turns != null && (
        <span>Turns: {info.num_turns}</span>
      )}
    </div>
  );
}
