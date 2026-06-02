import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import type { ChatMessage, ContentBlock } from "../types";
import { getToolConfig } from "./tools/toolConfigs";
import { OneLineTool } from "./tools/OneLineTool";
import { CollapsibleTool } from "./tools/CollapsibleTool";

interface Props {
  message: ChatMessage;
  isStreaming?: boolean;
  onSelectOption?: (text: string) => void;
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = extractText(children);
    navigator.clipboard.writeText(text.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-block-wrapper">
      <pre>{children}</pre>
      <button className="code-copy-btn" onClick={handleCopy}>
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

function extractText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node && typeof node === "object" && "props" in node) {
    return extractText((node as { props: { children?: React.ReactNode } }).props.children);
  }
  return "";
}

function ToolBlock({ block, onSelectOption }: { block: ContentBlock; onSelectOption?: (text: string) => void }) {
  const config = getToolConfig(block.name ?? "");

  // present_options: special rendering handled by parent
  if (block.kind === "tool_use" && block.name === "present_options" && onSelectOption) {
    const input = (block.input ?? {}) as Record<string, unknown>;
    const question = String(input.question ?? "");
    const options = (input.options as string[]) ?? [];
    return (
      <div className="chat-options-card">
        {question && <div className="chat-options-question">{question}</div>}
        <div className="chat-options-list">
          {options.map((opt, j) => (
            <button key={j} className="chat-option-btn" onClick={() => onSelectOption(opt)}>
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
}

export function MessageBubble({ message, isStreaming, onSelectOption }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`chat-message ${isUser ? "chat-message--user" : ""} ${isStreaming ? "chat-message--streaming" : ""}`}>
      <div className={`chat-avatar ${isUser ? "chat-avatar--user" : "chat-avatar--assistant"}`}>
        {isUser ? "U" : "AI"}
      </div>
      <div className="chat-message-content">
        {isUser ? (
          <div className="chat-bubble-user">
            {message.content.map((block, i) =>
              block.kind === "text" ? <span key={i}>{block.text}</span> : null
            )}
          </div>
        ) : (
          <>
            {message.content.map((block, i) => {
              if (block.kind === "text" && block.text) {
                return (
                  <div key={i} className="markdown-body chat-bubble-assistant">
                    <Markdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeHighlight]}
                      components={{ pre: CodeBlock }}
                    >
                      {block.text}
                    </Markdown>
                  </div>
                );
              }
              if (block.kind === "tool_use" || block.kind === "tool_result") {
                return <ToolBlock key={i} block={block} onSelectOption={onSelectOption} />;
              }
              return null;
            })}
          </>
        )}
      </div>
    </div>
  );
}
