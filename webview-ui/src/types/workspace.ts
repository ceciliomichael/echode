export interface WorkspaceContext {
  path: string;
  name: string;
  files: string[];
}

declare global {
  interface Window {
    workspaceContext: WorkspaceContext | null;
  }
}