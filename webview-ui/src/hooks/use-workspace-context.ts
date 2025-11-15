import { useState, useEffect } from 'react';
import type { WorkspaceContext } from '../types/workspace';

export function useWorkspaceContext() {
  const [workspace, setWorkspace] = useState<WorkspaceContext | null>(null);

  useEffect(() => {
    if (window.workspaceContext) {
      setWorkspace(window.workspaceContext);
    }
  }, []);

  return workspace;
}