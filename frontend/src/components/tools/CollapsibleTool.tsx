import { useState } from "react";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";
import type { ContentBlock } from "../../types";
import type { ToolConfig } from "./toolConfigs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";

interface Props {
  block: ContentBlock;
  config: ToolConfig;
}

function DiffView({ input }: { input: Record<string, unknown> }) {
  const filePath = String(input.file_path ?? "");
  const oldStr = String(input.old_string ?? "");
  const newStr = String(input.new_string ?? "");

  return (
    <div className="overflow-auto max-h-[400px]">
      {filePath && (
        <div className="px-3 py-1.5 bg-muted font-mono text-[11px] text-muted-foreground border-b border-border">
          {filePath}
        </div>
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
              diffViewerBackground: "hsl(0 0% 98%)",
              addedBackground: "hsl(127 100% 87%)",
              addedColor: "hsl(142 71% 45%)",
              removedBackground: "hsl(0 80% 92%)",
              removedColor: "hsl(0 72% 51%)",
              wordAddedBackground: "hsl(141 78% 86%)",
              wordRemovedBackground: "hsl(0 84% 85%)",
              addedGutterBackground: "hsl(129 58% 93%)",
              removedGutterBackground: "hsl(0 70% 93%)",
              gutterBackground: "hsl(0 0% 97%)",
              gutterBackgroundDark: "hsl(0 0% 93%)",
              codeFoldGutterBackground: "hsl(213 100% 94%)",
              codeFoldBackground: "hsl(213 91% 96%)",
              emptyLineBackground: "hsl(0 0% 97%)",
              gutterColor: "hsl(0 0% 60%)",
              addedGutterColor: "hsl(142 71% 45%)",
              removedGutterColor: "hsl(0 72% 51%)",
              codeFoldContentColor: "hsl(0 0% 40%)",
              diffViewerTitleBackground: "hsl(0 0% 98%)",
              diffViewerTitleColor: "hsl(0 0% 40%)",
              diffViewerTitleBorderColor: "hsl(0 0% 90%)",
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
      <Collapsible open={open} onOpenChange={setOpen} className="mt-2.5 border border-border rounded-[10px] overflow-hidden text-[13px]">
        <CollapsibleTrigger className="w-full px-3 py-2 bg-muted/80 hover:bg-accent cursor-pointer flex justify-between items-center font-mono text-[12px] text-muted-foreground transition-colors">
          <span className="flex items-center gap-1.5 truncate">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-muted-foreground/20 text-[10px] font-bold text-muted-foreground shrink-0">
              {config.icon}
            </span>
            {config.label}: {value}
          </span>
          {open ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border">
            {config.contentType === "diff" && (block.input?.old_string !== undefined || block.input?.new_string !== undefined) ? (
              <DiffView input={block.input} />
            ) : (
              <pre className="m-0 p-2.5 bg-muted/30 overflow-auto max-h-[240px] text-[12px] font-mono leading-relaxed">
                {JSON.stringify(block.input, null, 2)}
              </pre>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  if (config.resultDisplay === "hidden") return null;
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-2.5 border border-border rounded-[10px] overflow-hidden text-[13px]">
      <CollapsibleTrigger className="w-full px-3 py-2 bg-muted/80 hover:bg-accent cursor-pointer flex justify-between items-center font-mono text-[12px] text-muted-foreground transition-colors">
        <span>output</span>
        {open ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="m-0 p-2.5 bg-zinc-900 text-zinc-300 overflow-auto max-h-[240px] text-[12px] font-mono leading-relaxed border-t border-border">
          {block.content}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}
