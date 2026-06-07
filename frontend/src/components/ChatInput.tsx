import { useEffect, useRef } from "react";
import type { ImageAttachment } from "../types";
import type { SlashCommand } from "./SlashCommandMenu";
import { SlashCommandMenu } from "./SlashCommandMenu";
import { X, Paperclip } from "lucide-react";

const SLASH_MENU_POSITION = { top: 0, left: 42 };

interface Props {
  input: string;
  setInput: (v: string) => void;
  streaming: boolean;
  mode: "plan" | "code";
  setMode: (m: "plan" | "code") => void;
  attachments: ImageAttachment[];
  onRemoveAttachment: (id: string) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onSend: () => void;
  onStop: () => void;
  canSend: boolean;
  slashMenuOpen: boolean;
  setSlashMenuOpen: (v: boolean) => void;
  slashFilter: string;
  slashCommands: SlashCommand[];
  onSlashInputChange: (value: string) => void;
}

export function ChatInput({
  input,
  setInput,
  streaming,
  mode,
  setMode,
  attachments,
  onRemoveAttachment,
  onPaste,
  onFileSelect,
  fileInputRef,
  onSend,
  onStop,
  canSend,
  slashMenuOpen,
  setSlashMenuOpen,
  slashFilter,
  slashCommands,
  onSlashInputChange,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 160) + "px";
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (slashMenuOpen) return;
    if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onSend();
    }
  };

  const handleSlashSelect = (cmd: SlashCommand) => {
    setInput(cmd.name + " ");
    setSlashMenuOpen(false);
    textareaRef.current?.focus();
  };

  return (
    <div className="px-6 pb-6 flex justify-center items-end shrink-0 gap-5">
      <div className="flex rounded-full overflow-hidden border border-border bg-muted shrink-0 self-center">
        <button
          className={`px-3.5 py-1.5 text-[13px] border-none cursor-pointer transition-colors ${
            mode === "plan" ? "bg-green-700 text-white font-semibold" : "bg-transparent text-muted-foreground"
          } ${streaming ? "opacity-60 cursor-default" : ""}`}
          onClick={() => setMode("plan")}
          disabled={streaming}
        >
          Plan
        </button>
        <button
          className={`px-3.5 py-1.5 text-[13px] border-none cursor-pointer transition-colors ${
            mode === "code" ? "bg-primary text-primary-foreground font-semibold" : "bg-transparent text-muted-foreground"
          } ${streaming ? "opacity-60 cursor-default" : ""}`}
          onClick={() => setMode("code")}
          disabled={streaming}
        >
          Code
        </button>
      </div>
      <div className="max-w-3xl w-full relative">
        {attachments.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap">
            {attachments.map((att) => (
              <div key={att.id} className="relative group">
                <img
                  src={att.previewUrl}
                  alt={att.name}
                  className="w-16 h-16 object-cover rounded-lg border border-border"
                />
                <button
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onRemoveAttachment(att.id)}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          multiple
          className="hidden"
          onChange={onFileSelect}
        />

        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            onSlashInputChange(e.target.value);
          }}
          onPaste={onPaste}
          onBlur={() => setTimeout(() => setSlashMenuOpen(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder="Message... (type / for commands, Shift+Enter for new line)"
          className="w-full py-3.5 pl-[42px] pr-[52px] rounded-3xl border border-input text-[15px] resize-none outline-none leading-relaxed min-h-[48px] max-h-[160px] overflow-hidden shadow-sm transition-[border-color,box-shadow] focus:border-primary focus:shadow-[0_2px_12px_rgba(25,118,210,0.12)] disabled:bg-muted/50 disabled:opacity-70 placeholder:text-muted-foreground/50"
        />

        {slashMenuOpen && (
          <SlashCommandMenu
            commands={slashCommands}
            filter={slashFilter}
            position={SLASH_MENU_POSITION}
            onSelect={handleSlashSelect}
            onClose={() => setSlashMenuOpen(false)}
          />
        )}

        <button
          className="absolute left-2 top-[calc(50%-4px)] -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
          onClick={() => fileInputRef.current?.click()}
          disabled={streaming}
          title="Attach image"
        >
          <Paperclip size={18} />
        </button>

        {streaming && (
          <button
            className="absolute right-12 top-[calc(50%-4px)] -translate-y-1/2 w-9 h-9 rounded-full bg-background border border-destructive text-destructive flex items-center justify-center cursor-pointer transition-colors hover:bg-destructive/10"
            onClick={onStop}
            title="Stop"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        )}
        <button
          className={`absolute right-2 top-[calc(50%-4px)] -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
            !canSend
              ? "bg-muted text-muted-foreground cursor-default"
              : "bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90 active:scale-95"
          }`}
          onClick={onSend}
          disabled={!canSend}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
