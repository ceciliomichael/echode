import { useEffect, useRef } from 'react';
import { registerRemoteTool, unregisterTool } from '../lib/tool-registry';
import { vscode } from '../utils/vscode';

interface RemoteTool {
  name: string;
  description: string;
  inputSchema?: any;
}

/**
 * Hook to synchronize MCP tools from the extension host to the webview tool registry
 */
export function useMcpToolSync() {
  // Track currently registered remote tools to enable cleanup
  const registeredToolIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      
      if (message.type === 'mcp.toolsUpdate') {
        const tools = message.tools as RemoteTool[];
        const newToolIds = new Set(tools.map(t => t.name));
        
        // Unregister tools that are gone
        for (const toolId of registeredToolIds.current) {
          if (!newToolIds.has(toolId)) {
            unregisterTool(toolId);
          }
        }
        
        // Register new/existing tools (overwriting is safe/idempotent)
        for (const tool of tools) {
          registerRemoteTool(tool);
        }
        
        registeredToolIds.current = newToolIds;
      }
    };
    
    window.addEventListener('message', handleMessage);
    
    // Request initial state on mount
    vscode.postMessage({ type: 'mcp.getStatuses' });

    return () => window.removeEventListener('message', handleMessage);
  }, []);
}