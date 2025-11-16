import { useState, useEffect } from 'react';
import type { WorkspaceContext } from '../types/workspace';

export function useWorkspaceContext() {
  const [workspace, setWorkspace] = useState<WorkspaceContext | null>(() => {
    return window.workspaceContext || null;
  });

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'workspaceInfo') {
        setWorkspace(message.workspace);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return workspace;
}