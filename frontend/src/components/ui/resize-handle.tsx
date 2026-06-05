import { cn } from "@/lib/utils";

interface ResizeHandleProps {
  direction: "horizontal" | "vertical";
  onMouseDown: (e: React.MouseEvent) => void;
  className?: string;
}

export function ResizeHandle({ direction, onMouseDown, className }: ResizeHandleProps) {
  return (
    <div
      className={cn(
        "group relative flex items-center justify-center shrink-0 transition-colors",
        direction === "horizontal"
          ? "w-1 cursor-col-resize"
          : "h-px cursor-row-resize",
        className
      )}
      onMouseDown={onMouseDown}
    >
      {/* Invisible hit area */}
      <div
        className={cn(
          "absolute",
          direction === "horizontal"
            ? "inset-y-0 -inset-x-2"
            : "inset-x-0 -inset-y-2"
        )}
      />
      {/* Visible grip dot */}
      <div
        className={cn(
          "rounded-full bg-border transition-colors group-hover:bg-primary",
          direction === "horizontal"
            ? "w-1 h-8 group-hover:h-10"
            : "h-1 w-8 group-hover:w-10"
        )}
      />
    </div>
  );
}
