import { useEffect, useLayoutEffect, useRef, useState } from "react";

export interface SlashCommand {
  name: string;
  description: string;
}

interface Props {
  commands: SlashCommand[];
  filter: string;
  position: { top: number; left: number };
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
}

export function SlashCommandMenu({ commands, filter, position, onSelect, onClose }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const filtered = commands.filter((c) => c.name.startsWith("/" + filter));

  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  useLayoutEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (!filtered.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        onSelect(filtered[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", handleKey, true);
    return () => document.removeEventListener("keydown", handleKey, true);
  }, [filtered, selectedIndex, onSelect, onClose]);

  if (filtered.length === 0) {
    return (
      <div
        className="absolute z-50 mb-1 bg-popover border border-border rounded-lg shadow-lg p-2 text-xs text-muted-foreground"
        style={{ bottom: "100%", left: position.left }}
      >
        No matching commands
      </div>
    );
  }

  return (
    <div
      className="absolute z-50 mb-1 bg-popover border border-border rounded-lg shadow-lg py-1 max-h-64 overflow-y-auto"
      style={{ bottom: "100%", left: position.left, minWidth: 240 }}
      ref={listRef}
    >
      {filtered.map((cmd, i) => (
        <div
          key={cmd.name}
          className={`px-3 py-2 cursor-pointer text-sm flex items-center gap-3 ${
            i === selectedIndex ? "bg-accent text-accent-foreground" : "text-foreground"
          }`}
          onMouseEnter={() => setSelectedIndex(i)}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(cmd);
          }}
        >
          <span className="font-mono text-xs font-semibold min-w-[72px]">{cmd.name}</span>
          <span className="text-muted-foreground text-xs truncate">{cmd.description}</span>
        </div>
      ))}
    </div>
  );
}
