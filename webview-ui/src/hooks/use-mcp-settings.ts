import { useState, useEffect, useCallback } from 'react';
import type { MCPServerConfig, MCPServerStatus } from '../components/mcp/types';
import { vscode } from '../utils/vscode';

export function useMCPSettings() {
  const [configs, setConfigs] = useState<MCPServerConfig[]>([]);
  const [statuses, setStatuses] = useState<Record<string, MCPServerStatus>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Initial load
    vscode.postMessage({ type: 'mcp.getConfigs' });
    vscode.postMessage({ type: 'mcp.getStatuses' });

    // Listener for messages from extension
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case 'mcp.configs':
          setConfigs(message.configs);
          setLoading(false);
          break;
        case 'mcp.statuses': {
          const newStatuses: Record<string, MCPServerStatus> = {};
          message.statuses.forEach((s: MCPServerStatus) => {
            newStatuses[s.serverId] = s;
          });
          setStatuses(newStatuses);
          break;
        }
        case 'mcp.statusUpdate': {
          setStatuses(prev => ({
            ...prev,
            [message.status.serverId]: message.status
          }));
          setLoading(false);
          break;
        }
        case 'mcp.error':
          console.error('MCP Error:', message.error);
          setLoading(false);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const saveConfig = useCallback((config: MCPServerConfig) => {
    setLoading(true);
    vscode.postMessage({ type: 'mcp.saveConfig', config });
  }, []);

  const deleteConfig = useCallback((serverId: string) => {
    setLoading(true);
    vscode.postMessage({ type: 'mcp.deleteConfig', serverId });
  }, []);

  const connectServer = useCallback((config: MCPServerConfig) => {
    setLoading(true);
    // Optimistic update
    setStatuses(prev => ({
      ...prev,
      [config.id]: { serverId: config.id, status: 'connecting' }
    }));
    vscode.postMessage({ type: 'mcp.connect', config });
  }, []);

  const disconnectServer = useCallback((serverId: string) => {
    setLoading(true);
    vscode.postMessage({ type: 'mcp.disconnect', serverId });
  }, []);

  const refreshServer = useCallback((serverId: string) => {
    setLoading(true);
    vscode.postMessage({ type: 'mcp.refresh', serverId });
  }, []);

  return {
    configs,
    statuses,
    loading,
    saveConfig,
    deleteConfig,
    connectServer,
    disconnectServer,
    refreshServer
  };
}