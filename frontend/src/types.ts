export interface Folder {
  id: string;
  name: string;
  folder_path: string;
}

export interface FolderCreate {
  name: string;
  folder_path: string;
  task_names: string[];
}

export interface Task {
  id: string;
  name: string;
  folder_id: string;
  plan_path: string | null;
}

export interface TaskCreate {
  name: string;
  folder_id: string;
}

export interface TaskUpdate {
  name?: string;
}

export interface FileInfo {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
}

export interface ContentBlock {
  kind: "text" | "tool_use" | "tool_result" | "unknown";
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
  content?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: ContentBlock[];
}

export interface PlanFile {
  name: string;
  path: string;
  modified_at: string;
}
