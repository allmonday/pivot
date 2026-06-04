import { useState } from "react";
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

export function OneLineTool({ block, config }: Props) {
  const [open, setOpen] = useState(false);

  if (block.kind === "tool_use") {
    const value = config.getValue(block.input ?? {});
    return (
      <Collapsible open={open} onOpenChange={setOpen} className="mt-2 rounded-lg overflow-hidden text-[13px]">
        <CollapsibleTrigger className="w-full px-2.5 py-1.5 flex items-center gap-2 cursor-pointer bg-muted/80 hover:bg-accent rounded-lg font-mono text-[12px] text-muted-foreground transition-colors">
          <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1 rounded bg-muted-foreground/20 text-[10px] font-semibold text-muted-foreground shrink-0">
            {config.icon}
          </span>
          <span className="flex-1 truncate text-left">{value}</span>
          {open ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <pre className="m-0 p-2.5 bg-muted/30 overflow-auto max-h-[240px] text-[12px] font-mono leading-relaxed">
            {JSON.stringify(block.input, null, 2)}
          </pre>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  if (config.resultDisplay === "hidden") return null;
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-2 rounded-lg overflow-hidden text-[13px]">
      <CollapsibleTrigger className="w-full px-2.5 py-1.5 flex items-center gap-2 cursor-pointer bg-muted/80 hover:bg-accent rounded-lg font-mono text-[12px] text-muted-foreground transition-colors">
        <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1 rounded bg-muted-foreground/20 text-[10px] font-semibold text-muted-foreground shrink-0">
          out
        </span>
        <span className="flex-1 truncate text-left">output</span>
        {open ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="m-0 p-2.5 bg-zinc-900 text-zinc-300 overflow-auto max-h-[240px] text-[12px] font-mono leading-relaxed">
          {block.content}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}
