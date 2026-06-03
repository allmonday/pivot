import { useState } from "react";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";
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
      <ReactDiffViewer
        oldValue={oldStr}
        newValue={newStr}
        splitView={true}
        compareMethod={DiffMethod.WORDS}
        hideLineNumbers={false}
        styles={{
          variables: {
            light: {
              diffViewerBackground: "#fafafa",
              addedBackground: "#dcfce7",
              addedColor: "#15803d",
              removedBackground: "#fde8e8",
              removedColor: "#b91c1c",
              wordAddedBackground: "#bbf7d0",
              wordRemovedBackground: "#fecaca",
              addedGutterBackground: "#e8f5e9",
              removedGutterBackground: "#ffebee",
              gutterBackground: "#f7f7f8",
              gutterBackgroundDark: "#eee",
              codeFoldGutterBackground: "#dbedff",
              codeFoldBackground: "#f1f8ff",
              emptyLineBackground: "#f7f7f8",
              gutterColor: "#999",
              addedGutterColor: "#15803d",
              removedGutterColor: "#b91c1c",
              codeFoldContentColor: "#666",
              diffViewerTitleBackground: "#fafafa",
              diffViewerTitleColor: "#666",
              diffViewerTitleBorderColor: "#e5e5e5",
            },
          },
          contentText: {
            fontSize: "12px",
            fontFamily: "'SF Mono', 'Menlo', monospace",
            lineHeight: "1.5",
          },
          gutter: {
            padding: "0 8px",
            fontSize: "11px",
            minWidth: "40px",
          },
        }}
      />
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
