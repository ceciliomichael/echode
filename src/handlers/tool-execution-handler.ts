import * as vscode from 'vscode';
import { defaultRegistry } from '../services/tools/tool-registry';
import { ReadFileTool, WriteFileTool, ListFilesTool, GrepSearchTool, GlobSearchTool, DeleteFileTool, EditFileTool, MultiEditTool, TodoWriteTool, TodoReadTool } from '../services/tools';

// Register tools
defaultRegistry.registerTool(new ReadFileTool());
defaultRegistry.registerTool(new WriteFileTool());
defaultRegistry.registerTool(new ListFilesTool());
defaultRegistry.registerTool(new GrepSearchTool());
defaultRegistry.registerTool(new GlobSearchTool());
defaultRegistry.registerTool(new DeleteFileTool());
defaultRegistry.registerTool(new EditFileTool());
defaultRegistry.registerTool(new MultiEditTool());
defaultRegistry.registerTool(new TodoWriteTool());
defaultRegistry.registerTool(new TodoReadTool());

interface ToolExecutionMessage {
  type: 'executeTool';
  requestId: string;
  toolName: string;
  parameters: Record<string, unknown>;
}

interface ToolExecutionResponse {
  type: 'toolExecutionResult';
  requestId: string;
  result: {
    success: boolean;
    data?: unknown;
    error?: string;
  };
}

/**
 * Handle tool execution requests from webview
 */
export async function handleToolExecution(
  data: ToolExecutionMessage,
  webviewView: vscode.WebviewView | vscode.WebviewPanel,
): Promise<void> {
  const { requestId, toolName, parameters } = data;

  try {
    const tool = defaultRegistry.getTool(toolName);

    if (!tool) {
        const response: ToolExecutionResponse = {
            type: 'toolExecutionResult',
            requestId,
            result: {
              success: false,
              error: `Unknown tool: ${toolName}`,
            }
        };
        webviewView.webview.postMessage(response);
        return;
    }

    const result = await tool.execute(parameters);

    const response: ToolExecutionResponse = {
      type: 'toolExecutionResult',
      requestId,
      result: {
        success: result.success,
        data: result.data,
        error: result.error,
      }
    };

    webviewView.webview.postMessage(response);
  } catch (error) {
    console.error(`Tool execution error (${toolName}):`, error);
    const response: ToolExecutionResponse = {
      type: 'toolExecutionResult',
      requestId,
      result: {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    };
    webviewView.webview.postMessage(response);
  }
}
