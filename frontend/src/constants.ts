// ── Layout sizing ──────────────────────────────────────────────
export const SIDEBAR_WIDTH = 280;

export const FILE_EXPLORER_MIN_HEIGHT = 150;
export const FILE_EXPLORER_MAX_HEIGHT = 600;
export const FILE_EXPLORER_MIN_WIDTH = 200;

export const PLAN_PANEL_MIN_WIDTH = 250;
export const HISTORY_PANEL_MIN_WIDTH = 300;

export const TERMINAL_MIN_HEIGHT = 150;
export const TERMINAL_MAX_HEIGHT = 500;

export const PANEL_MAX_WIDTH_RATIO = 0.8;

// ── Default panel sizes (used by useLayout) ────────────────────
export const DEFAULT_PLAN_WIDTH = 400;
export const DEFAULT_HISTORY_WIDTH = 500;
export const DEFAULT_FILE_EXPLORER_HEIGHT = 300;
export const DEFAULT_TERMINAL_HEIGHT = 250;

// ── Image attachments ─────────────────────────────────────────
export const VALID_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"] as const;
export const VALID_IMAGE_ACCEPT = VALID_IMAGE_TYPES.join(",");
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
export const MAX_IMAGES = 5;
