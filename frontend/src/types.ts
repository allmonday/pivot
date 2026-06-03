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
  plan_paths: string[];
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
  kind: "text" | "tool_use" | "tool_result" | "thinking" | "image" | "unknown";
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
  content?: string;
  source?: {
    type: "base64";
    media_type: string;
    data: string;
  };
}

export interface ImageAttachment {
  id: string;
  base64: string;
  mediaType: string;
  previewUrl: string;
  name: string;
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

export interface ResultInfo {
  total_cost_usd: number | null;
  duration_ms: number | null;
  duration_api_ms: number | null;
  num_turns: number | null;
}

export interface PermissionRequest {
  request_id: string;
  tool_name: string;
  title: string | null;
  description: string | null;
  blocked_path: string | null;
}
