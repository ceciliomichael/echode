/**
 * Represents a single workspace folder in a multi-root workspace
 */
export interface WorkspaceFolder {
  name: string;
  path: string;
}

/**
 * Workspace context passed to the webview
 * Supports both single-folder and multi-root workspaces
 */
export interface WorkspaceContext {
  /** Primary workspace path (first folder for backward compatibility) */
  path: string;
  /** Primary workspace name (first folder for backward compatibility) */
  name: string;
  /** All files in the workspace (prefixed with folder name in multi-root) */
  files: string[];
  /** AGENTS.md content if present */
  agentsConfig: string | null;
  /** Detected default terminal shell type (e.g. "PowerShell", "Command Prompt", "Bash") */
  shellType?: string;
  /** True if workspace has multiple root folders */
  isMultiRoot?: boolean;
  /** All workspace folders (populated in multi-root workspaces) */
  folders?: WorkspaceFolder[];
}

declare global {
  interface Window {
    workspaceContext: WorkspaceContext | null;
  }
}