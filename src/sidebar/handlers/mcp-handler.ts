import * as vscode from 'vscode';
import { getGlobalServerManager } from '../../services/mcp/mcp-server-manager';
import { defaultRegistry } from '../../services/tools/tool-registry';

/**
 * Handle MCP-related messages from the webview
 */
export async function handleMcpMessage(
  message: any,
  panel: vscode.WebviewPanel | vscode.WebviewView
): Promise<void> {
  const serverManager = getGlobalServerManager(defaultRegistry);

  try {
    switch (message.type) {
      case 'mcp.getConfigs': {
        const configs = await serverManager.getConfigs();
        panel.webview.postMessage({ type: 'mcp.configs', configs });
        break;
      }

      case 'mcp.getStatuses': {
        const statuses = serverManager.getAllStatuses();
        panel.webview.postMessage({ type: 'mcp.statuses', statuses });
        
        // Also send current tools
        const tools = serverManager.getAllConnectedTools();
        panel.webview.postMessage({ type: 'mcp.toolsUpdate', tools });
        break;
      }

      case 'mcp.saveConfig': {
        await serverManager.saveConfig(message.config);
        // Refresh configs for UI
        const configs = await serverManager.getConfigs();
        panel.webview.postMessage({ type: 'mcp.configs', configs });
        // Refresh statuses
        const statuses = serverManager.getAllStatuses();
        panel.webview.postMessage({ type: 'mcp.statuses', statuses });
        break;
      }

      case 'mcp.deleteConfig': {
        await serverManager.deleteConfig(message.serverId);
        // Refresh configs for UI
        const configs = await serverManager.getConfigs();
        panel.webview.postMessage({ type: 'mcp.configs', configs });
        // Refresh statuses
        const statuses = serverManager.getAllStatuses();
        panel.webview.postMessage({ type: 'mcp.statuses', statuses });
        break;
      }

      case 'mcp.connect': {
        await serverManager.connect(message.config);
        // Status updates are handled by the event listener, but we can force a refresh
        const statuses = serverManager.getAllStatuses();
        panel.webview.postMessage({ type: 'mcp.statuses', statuses });
        break;
      }

      case 'mcp.disconnect': {
        await serverManager.disconnect(message.serverId);
        // Status updates are handled by the event listener
        break;
      }

      case 'mcp.refresh': {
        // Disconnect and reconnect
        const config = serverManager.getConfig(message.serverId);
        if (config) {
          await serverManager.disconnect(message.serverId);
          await serverManager.connect(config);
        }
        break;
      }
    }
  } catch (error) {
    console.error('MCP Handler Error:', error);
    panel.webview.postMessage({
      type: 'mcp.error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Setup MCP status listener to push updates to the webview
 */
export function setupMcpStatusListener(panel: vscode.WebviewPanel | vscode.WebviewView): vscode.Disposable {
  const serverManager = getGlobalServerManager(defaultRegistry);
  
  return serverManager.onStatusChange((status) => {
    panel.webview.postMessage({
      type: 'mcp.statusUpdate',
      status
    });

    // Also send updated tool list
    const tools = serverManager.getAllConnectedTools();
    panel.webview.postMessage({
      type: 'mcp.toolsUpdate',
      tools
    });
  });
}