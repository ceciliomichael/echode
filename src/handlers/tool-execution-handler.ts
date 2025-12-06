import * as vscode from 'vscode';
import { defaultRegistry } from '../services/tools/tool-registry';
import { ReadFileTool, WriteFileTool, ListFilesTool, GrepSearchTool, GlobSearchTool, DeleteFileTool, TodoWriteTool, TodoReadTool, PlanNavigatorTool, PlanHandoffTool, ApplyDiffTool, GetDiagnosticsTool, EchoSearchTool } from '../services/tools';
import { getWorkspaceFiles, getAgentsConfig } from '../utils/workspace-scanner';

// Tools that modify the file system and require workspace refresh
const FILE_MODIFYING_TOOLS = new Set(['write_to_file', 'delete_file', 'apply_diff']);

// Optional callback that can be set by the sidebar provider to trigger
// a refactor/large-file scan after successful write_to_file/apply_diff
let onFileModificationSuccess: (() => void) | null = null;

export function setFileModificationCallback(callback: (() => void) | null): void {
  onFileModificationSuccess = callback;
}

// Track active tool executions for cancellation
const activeToolExecutions = new Map<string, AbortController>();

// Register tools
defaultRegistry.registerTool(new ReadFileTool());
defaultRegistry.registerTool(new WriteFileTool());
defaultRegistry.registerTool(new ListFilesTool());
defaultRegistry.registerTool(new GrepSearchTool());
defaultRegistry.registerTool(new GlobSearchTool());
defaultRegistry.registerTool(new DeleteFileTool());
defaultRegistry.registerTool(new TodoWriteTool());
defaultRegistry.registerTool(new TodoReadTool());
defaultRegistry.registerTool(new PlanNavigatorTool());
defaultRegistry.registerTool(new PlanHandoffTool());
defaultRegistry.registerTool(new ApplyDiffTool());
defaultRegistry.registerTool(new GetDiagnosticsTool());
defaultRegistry.registerTool(new EchoSearchTool());

interface ToolExecutionMessage {
  type: 'executeTool';
  requestId: string;
  toolName: string;
  parameters: Record<string, unknown>;
}

interface ToolAbortMessage {
  type: 'abortToolExecution';
  requestId: string;
  toolName: string;
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

interface ToolExecutionProgressMessage {
  type: 'toolExecutionProgress';
  requestId: string;
  progress: unknown;
}

/**
 * Handle tool execution requests from webview
 */
export async function handleToolExecution(
  data: ToolExecutionMessage | ToolAbortMessage,
  webviewView: vscode.WebviewView | vscode.WebviewPanel,
): Promise<void> {
  
  // Handle abort request
  if (data.type === 'abortToolExecution') {
    const controller = activeToolExecutions.get(data.requestId);
    if (controller) {
      console.log(`[ToolHandler] Aborting tool execution ${data.requestId}`);
      controller.abort();
      activeToolExecutions.delete(data.requestId);
    }
    return;
  }

  const { requestId, toolName, parameters } = data;

  // Create abort controller for this execution
  const abortController = new AbortController();
  activeToolExecutions.set(requestId, abortController);

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

    // Create progress callback that sends updates to webview
    const onProgress = (progress: unknown) => {
      const progressMessage: ToolExecutionProgressMessage = {
        type: 'toolExecutionProgress',
        requestId,
        progress,
      };
      webviewView.webview.postMessage(progressMessage);
    };

    // Execute tool with cancellation signal
    const result = await tool.execute(parameters, onProgress, abortController.signal);

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

    // If a file-modifying tool succeeded, send fresh workspace info so mentions update
    if (result.success && FILE_MODIFYING_TOOLS.has(toolName)) {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (workspaceFolders && workspaceFolders.length > 0) {
        const workspaceInfo = {
          path: workspaceFolders[0].uri.fsPath,
          name: workspaceFolders[0].name,
          files: getWorkspaceFiles(workspaceFolders[0].uri.fsPath),
          agentsConfig: getAgentsConfig(workspaceFolders[0].uri.fsPath)
        };
        webviewView.webview.postMessage({
          type: 'workspaceInfo',
          workspace: workspaceInfo
        });
      }

      // Trigger refactor scan ONLY for write_to_file and apply_diff, as requested
      if (onFileModificationSuccess && (toolName === 'write_to_file' || toolName === 'apply_diff')) {
        try {
          onFileModificationSuccess();
        } catch (scanError) {
          console.warn('[ToolHandler] Refactor scan callback failed:', scanError);
        }
      }
    }
  } catch (error) {
    // Check if it was aborted
    if (abortController.signal.aborted) {
      console.log(`[ToolHandler] Tool execution ${requestId} aborted locally`);
      return; // Do not send error response for aborted requests
    }

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
  } finally {
    activeToolExecutions.delete(requestId);
  }
}
