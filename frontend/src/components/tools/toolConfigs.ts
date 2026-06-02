export type DisplayMode = "one-line" | "collapsible" | "hidden";

export interface ToolConfig {
  icon: string;
  label: string;
  display: DisplayMode;
  defaultOpen?: boolean;
  getValue: (input: Record<string, unknown>) => string;
  contentType?: "json" | "diff";
  resultDisplay?: DisplayMode;
}

const DEFAULT_CONFIG: ToolConfig = {
  icon: "T",
  label: "Tool",
  display: "collapsible",
  getValue: () => "",
  contentType: "json",
  resultDisplay: "collapsible",
};

export const toolConfigs: Record<string, ToolConfig> = {
  Bash: {
    icon: ">_",
    label: "Terminal",
    display: "one-line",
    getValue: (input) => String(input.command ?? "").slice(0, 120),
    contentType: "json",
    resultDisplay: "collapsible",
  },
  Read: {
    icon: "R",
    label: "Read",
    display: "one-line",
    getValue: (input) => String(input.file_path ?? ""),
    resultDisplay: "hidden",
  },
  Write: {
    icon: "W",
    label: "Write",
    display: "collapsible",
    defaultOpen: true,
    getValue: (input) => String(input.file_path ?? ""),
    contentType: "diff",
    resultDisplay: "hidden",
  },
  Edit: {
    icon: "E",
    label: "Edit",
    display: "collapsible",
    defaultOpen: true,
    getValue: (input) => String(input.file_path ?? ""),
    contentType: "diff",
    resultDisplay: "hidden",
  },
  MultiEdit: {
    icon: "E",
    label: "MultiEdit",
    display: "collapsible",
    defaultOpen: true,
    getValue: () => "multiple edits",
    contentType: "json",
    resultDisplay: "hidden",
  },
  Glob: {
    icon: "*",
    label: "Glob",
    display: "one-line",
    getValue: (input) => String(input.pattern ?? ""),
    resultDisplay: "collapsible",
  },
  Grep: {
    icon: "G",
    label: "Grep",
    display: "one-line",
    getValue: (input) => String(input.pattern ?? ""),
    resultDisplay: "collapsible",
  },
  present_options: {
    icon: "?",
    label: "Options",
    display: "hidden",
    getValue: () => "",
    resultDisplay: "hidden",
  },
};

export function getToolConfig(name: string): ToolConfig {
  return toolConfigs[name] ?? DEFAULT_CONFIG;
}
