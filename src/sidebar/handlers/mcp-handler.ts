import * as vscode from 'vscode';
import { getGlobalServerManager } from '../../services/mcp/mcp-server-manager';

/**
 * Handle MCP-related messages from the webview
 */
export async function handleMcpMessage(
  message: any,
  panel: vscode.WebviewPanel | vscode.WebviewView
): Promise<void> {
  const serverManager = getGlobalServerManager();

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
        // Set autoConnect to true when user explicitly connects
        const configToConnect = { ...message.config, autoConnect: true };
        await serverManager.connect(configToConnect);
        // Persist the autoConnect preference
        await serverManager.saveConfig(configToConnect);
        // Status updates are handled by the event listener, but we can force a refresh
        const statuses = serverManager.getAllStatuses();
        panel.webview.postMessage({ type: 'mcp.statuses', statuses });
        break;
      }

      case 'mcp.disconnect': {
        // Set autoConnect to false when user explicitly disconnects
        const configToDisconnect = serverManager.getConfig(message.serverId);
        if (configToDisconnect) {
          const updatedConfig = { ...configToDisconnect, autoConnect: false };
          await serverManager.saveConfig(updatedConfig);
        }
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

      case 'mcp.openConfig': {
        // Ensure config file exists and open it in VS Code editor
        await serverManager.ensureConfigExists();
        const configPath = serverManager.getConfigPath();
        if (configPath) {
          const uri = vscode.Uri.file(configPath);
          const document = await vscode.workspace.openTextDocument(uri);
          await vscode.window.showTextDocument(document, { preview: false });
        }
        break;
      }

      case 'mcp.toggleTool': {
        // Just toggle the tool - no need to send updates
        // The optimistic update in the frontend handles immediate UI feedback
        // The file watcher will sync any config changes if needed
        await serverManager.toggleTool(
          message.serverId,
          message.toolName,
          message.enabled
        );
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
  const serverManager = getGlobalServerManager();
  const disposables: vscode.Disposable[] = [];
  
  // Listen for status changes
  disposables.push(
    serverManager.onStatusChange((status) => {
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
    })
  );

  // Listen for config changes (e.g., when user edits mcp.json)
  disposables.push(
    serverManager.onConfigChange((configs) => {
      panel.webview.postMessage({
        type: 'mcp.configs',
        configs
      });
    })
  );

  return vscode.Disposable.from(...disposables);
}