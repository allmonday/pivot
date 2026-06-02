import { useState } from "react";
import type { ContentBlock } from "../../types";
import type { ToolConfig } from "./toolConfigs";

interface Props {
  block: ContentBlock;
  config: ToolConfig;
}

export function OneLineTool({ block, config }: Props) {
  const [open, setOpen] = useState(false);

  if (block.kind === "tool_use") {
    const value = config.getValue(block.input ?? {});
    return (
      <div className="tool-one-line">
        <div className="tool-one-line-header" onClick={() => setOpen(!open)}>
          <span className="tool-one-line-icon">{config.icon}</span>
          <span className="tool-one-line-value">{value}</span>
          <span className="tool-card-toggle">{open ? "\u25BC" : "\u25B6"}</span>
        </div>
        {open && block.input && (
          <pre className="tool-card-body">
            {JSON.stringify(block.input, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  // tool_result
  if (config.resultDisplay === "hidden") return null;
  return (
    <div className="tool-one-line">
      <div className="tool-one-line-header" onClick={() => setOpen(!open)}>
        <span className="tool-one-line-icon">out</span>
        <span className="tool-one-line-value">output</span>
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
