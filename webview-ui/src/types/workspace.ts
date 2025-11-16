export interface WorkspaceContext {
  path: string;
  name: string;
  files: string[];
  agentsConfig: string | null;
}

declare global {
  interface Window {
    workspaceContext: WorkspaceContext | null;
  }
}