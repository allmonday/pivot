import { memo, useMemo, useState } from "react";
import type { ChatMessage, ContentBlock } from "../types";
import { getToolConfig } from "./tools/toolConfigs";
import { OneLineTool } from "./tools/OneLineTool";
import { CollapsibleTool } from "./tools/CollapsibleTool";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface Props {
  message: ChatMessage;
  isStreaming?: boolean;
  onSelectOption?: (text: string) => void;
}

const ToolBlock = memo(function ToolBlock({ block, onSelectOption }: { block: ContentBlock; onSelectOption?: (text: string) => void }) {
  const config = getToolConfig(block.name ?? "");

  if (block.kind === "tool_use" && block.name === "present_options" && onSelectOption) {
    const input = (block.input ?? {}) as Record<string, unknown>;
    const question = String(input.question ?? "");
    const options = (input.options as string[]) ?? [];
    return (
      <div className="mt-2.5 p-3 border border-border rounded-xl bg-muted/50">
        {question && <div className="text-sm font-semibold text-foreground mb-2.5">{question}</div>}
        <div className="flex flex-col gap-1.5">
          {options.map((opt, j) => (
            <button
              key={j}
              className="py-2 px-3.5 border border-border rounded-lg bg-background text-foreground text-[13px] leading-snug text-left cursor-pointer transition-colors hover:border-primary hover:text-primary hover:bg-primary/5 active:bg-primary/10"
              onClick={() => onSelectOption(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (config.display === "hidden") return null;
  if (config.resultDisplay === "hidden" && block.kind === "tool_result") return null;

  if (config.display === "one-line") {
    return <OneLineTool block={block} config={config} />;
  }

  return <CollapsibleTool block={block} config={config} />;
});

function ThinkingBlock({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="my-1.5">
      <button
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <svg
          className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`}
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M6 4l4 4-4 4" />
        </svg>
        Thinking...
      </button>
      {expanded && (
        <div className="mt-1.5 pl-4 border-l-2 border-border text-xs text-muted-foreground whitespace-pre-wrap break-words">
          {text}
        </div>
      )}
    </div>
  );
}

type ContentGroup =
  | { type: "single"; block: ContentBlock; index: number }
  | { type: "tools"; blocks: { block: ContentBlock; index: number }[] };

function groupContentBlocks(blocks: ContentBlock[]): ContentGroup[] {
  const groups: ContentGroup[] = [];
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];
    if (block.kind === "tool_use" || block.kind === "tool_result") {
      const toolBlocks: { block: ContentBlock; index: number }[] = [];
      while (i < blocks.length && (blocks[i].kind === "tool_use" || blocks[i].kind === "tool_result")) {
        toolBlocks.push({ block: blocks[i], index: i });
        i++;
      }
      groups.push({ type: "tools", blocks: toolBlocks });
    } else {
      groups.push({ type: "single", block, index: i });
      i++;
    }
  }
  return groups;
}

function AssistantContent({ blocks, onSelectOption }: { blocks: ContentBlock[]; onSelectOption?: (text: string) => void }) {
  const groups = useMemo(() => groupContentBlocks(blocks), [blocks]);

  return (
    <>
      {groups.map((group) => {
        if (group.type === "single") {
          const { block, index: i } = group;
          if (block.kind === "thinking" && block.text) {
            return <ThinkingBlock key={i} text={block.text} />;
          }
          if (block.kind === "text" && block.text) {
            return (
              <div key={i} className="markdown-body max-w-full text-[15px] leading-relaxed">
                <MarkdownRenderer content={block.text} />
              </div>
            );
          }
          return null;
        }
        return (
          <div key={`tools-${group.blocks[0].index}`} className="max-h-[300px] overflow-auto scrollbar-thin my-2">
            {group.blocks.map(({ block, index: i }) => (
              <ToolBlock key={i} block={block} onSelectOption={onSelectOption} />
            ))}
          </div>
        );
      })}
    </>
  );
}

export const MessageBubble = memo(function MessageBubble({ message, isStreaming, onSelectOption }: Props) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex gap-4 py-5 ${isStreaming ? "" : "[animation:chatFadeIn_0.3s_ease-out]"}`}
    >
      <div
        className={`w-[30px] h-[30px] rounded-full shrink-0 flex items-center justify-center text-[13px] font-bold text-white select-none mt-1.5 ${
          isUser ? "bg-primary" : "bg-emerald-600"
        }`}
      >
        {isUser ? "U" : "AI"}
      </div>
      <div className="flex-1 min-w-0">
        {isUser ? (
          <div className="inline-block bg-primary/10 px-4 py-2.5 rounded-2xl max-w-[85%] break-words text-[15px] leading-relaxed">
            {message.content.map((block, i) => {
              if (block.kind === "text") return <span key={i}>{block.text}</span>;
              if (block.kind === "image" && block.source) {
                return (
                  <img
                    key={i}
                    src={`data:${block.source.media_type};base64,${block.source.data}`}
                    alt={block.text || "image"}
                    className="max-w-[280px] max-h-[200px] rounded-lg mt-1.5 border border-border"
                  />
                );
              }
              return null;
            })}
          </div>
        ) : (
          <AssistantContent blocks={message.content} onSelectOption={onSelectOption} />
        )}
      </div>
    </div>
  );
});
