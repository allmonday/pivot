import { useState } from "react";
import type { ContentBlock } from "../../types";
import type { ToolConfig } from "./toolConfigs";

interface Props {
  block: ContentBlock;
  config: ToolConfig;
}

function DiffView({ input }: { input: Record<string, unknown> }) {
  const filePath = String(input.file_path ?? "");
  const oldStr = String(input.old_string ?? "");
  const newStr = String(input.new_string ?? "");

  return (
    <div className="tool-diff">
      {filePath && (
        <div className="tool-diff-filename">{filePath}</div>
      )}
      <div className="tool-diff-panes">
        {oldStr && (
          <div className="tool-diff-pane tool-diff-pane--old">
            <div className="tool-diff-pane-header">Before</div>
            <pre className="tool-diff-content">{oldStr}</pre>
          </div>
        )}
        {newStr && (
          <div className="tool-diff-pane tool-diff-pane--new">
            <div className="tool-diff-pane-header">After</div>
            <pre className="tool-diff-content">{newStr}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

export function CollapsibleTool({ block, config }: Props) {
  const [open, setOpen] = useState(config.defaultOpen ?? false);

  if (block.kind === "tool_use") {
    const value = config.getValue(block.input ?? {});
    return (
      <div className="tool-card">
        <div className="tool-card-header" onClick={() => setOpen(!open)}>
          <span className="tool-card-label">
            <span className="tool-card-icon">{config.icon}</span>
            {config.label}: {value}
          </span>
          <span className="tool-card-toggle">{open ? "\u25BC" : "\u25B6"}</span>
        </div>
        {open && block.input && (
          <div className="tool-card-body-wrap">
            {config.contentType === "diff" && (block.input.old_string !== undefined || block.input.new_string !== undefined) ? (
              <DiffView input={block.input} />
            ) : (
              <pre className="tool-card-body">
                {JSON.stringify(block.input, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    );
  }

  // tool_result
  if (config.resultDisplay === "hidden") return null;
  return (
    <div className="tool-card">
      <div className="tool-card-header" onClick={() => setOpen(!open)}>
        <span>output</span>
        <span className="tool-card-toggle">{open ? "\u25BC" : "\u25B6"}</span>
      </div>
      {open && (
        <pre className="tool-card-body tool-card-body--result">
          {block.content}
        </pre>
      )}
    </div>
  );
}
