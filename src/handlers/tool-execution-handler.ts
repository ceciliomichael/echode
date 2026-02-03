import * as vscode from 'vscode';
import { defaultRegistry } from '../services/tools/tool-registry';
import { ReadFileTool, WriteFileTool, ListFilesTool, GrepSearchTool, GlobSearchTool, DeleteFileTool, TodoWriteTool, EditTool, GetDiagnosticsTool, PlanTool, PublishFindingsTool, RunTerminalTool } from '../services/tools';
import { getWorkspaceFiles, getAgentsConfig } from '../utils/workspace-scanner';
import { ApprovalViewerManager } from '../services/approval/approval-viewer-manager';
import type { ChatMode } from '../services/tools/tool.interface';
import { getSubAgentService } from '../services/sub-agent/sub-agent-service';

// Tools that modify the file system and require workspace refresh
const FILE_MODIFYING_TOOLS = new Set(['write_to_file', 'delete_file', 'edit']);

function escapeForLog(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
}

function truncateForLog(value: string, maxLen: number): string {
  if (value.length <= maxLen) {
    return value;
  }
  const head = value.slice(0, Math.max(0, Math.floor(maxLen * 0.6)));
  const tail = value.slice(Math.max(0, value.length - Math.max(0, Math.floor(maxLen * 0.4))));
  return `${head}…${tail}`;
}

function formatParamForLog(value: unknown): string {
  if (typeof value === 'string') {
    const escaped = escapeForLog(value);
    const truncated = truncateForLog(escaped, 600);
    return `string(len=${value.length}): ${truncated}`;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatToolExecutionDebug(toolName: string, parameters: Record<string, unknown>): string {
  if (toolName !== 'edit') {
    try {
      return JSON.stringify(parameters);
    } catch {
      return '[unserializable parameters]';
    }
  }

  const filePath = parameters.file_path;
  const oldString = parameters.old_string;
  const newString = parameters.new_string;
  const replaceAll = parameters.replace_all;
  const explanation = parameters.explanation;

  return [
    `file_path=${formatParamForLog(filePath)}`,
    `old_string=${formatParamForLog(oldString)}`,
    `new_string=${formatParamForLog(newString)}`,
    `replace_all=${formatParamForLog(replaceAll)}`,
    `explanation=${formatParamForLog(explanation)}`,
  ].join(' | ');
}

// Tools that require approval in Manual Mode
const APPROVAL_REQUIRED_TOOLS = new Set(['write_to_file', 'delete_file', 'edit', 'run_terminal']);

// Optional callback that can be set by the sidebar provider to trigger
// a refactor/large-file scan after successful write_to_file/edit
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
defaultRegistry.registerTool(new EditTool());
defaultRegistry.registerTool(new GetDiagnosticsTool());
defaultRegistry.registerTool(new PlanTool());
defaultRegistry.registerTool(new PublishFindingsTool());
defaultRegistry.registerTool(new RunTerminalTool());

interface ToolExecutionMessage {
  type: 'executeTool';
  requestId: string;
  toolName: string;
  parameters: Record<string, unknown>;
  mode?: ChatMode;
  sessionId?: string;
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
    console.log(`[ToolHandler] Received abort request for ${data.requestId}, active executions: ${Array.from(activeToolExecutions.keys()).join(', ')}`);
    const controller = activeToolExecutions.get(data.requestId);
    if (controller) {
      console.log(`[ToolHandler] Aborting tool execution ${data.requestId}`);
      controller.abort();
      activeToolExecutions.delete(data.requestId);
    } else {
      console.log(`[ToolHandler] No active execution found for ${data.requestId}`);
    }
    return;
  }

  const { requestId, toolName, parameters, mode, sessionId } = data;

  // Create abort controller for this execution
  const abortController = new AbortController();
  activeToolExecutions.set(requestId, abortController);

  try {
    // Inject sessionId into parameters for tools that need session isolation (like todo_write)
    if (sessionId) {
      parameters.sessionKey = sessionId;

      // Validate sub-agent tool permissions
      // If a session ID is present, check if it belongs to a sub-agent and validate allowedTools
      const subAgentService = getSubAgentService();
      const session = subAgentService.getSession(sessionId);
      
      if (session) {
        const definition = subAgentService.getDefinition(session.subAgentId);
        if (definition) {
          // Check if tool is allowed (report_back is always allowed)
          const isAllowed = toolName === 'report_back' || definition.allowedTools.includes(toolName);
          
          if (!isAllowed) {
            console.warn(`[ToolHandler] Blocked unauthorized tool usage: ${toolName} for sub-agent ${definition.name}`);
            const response: ToolExecutionResponse = {
              type: 'toolExecutionResult',
              requestId,
              result: {
                success: false,
                error: `Permission denied: Tool '${toolName}' is not allowed for this agent. Allowed tools: ${definition.allowedTools.join(', ')}`,
              }
            };
            webviewView.webview.postMessage(response);
            return;
          }
        }
      }
    }

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

    // Manual Mode: Request user approval for file-modifying and terminal tools
    if (mode === 'manual' && APPROVAL_REQUIRED_TOOLS.has(toolName) && tool.prepareExecution) {
      // Check if ApprovalViewerManager is initialized
      if (!ApprovalViewerManager.isInitialized) {
        console.warn('[ToolHandler] ApprovalViewerManager not initialized, skipping approval');
      } else {
        try {
          const confirmation = await tool.prepareExecution(parameters);
          
          if (confirmation) {
            // Request user approval via the dedicated approval panel
            const approved = await ApprovalViewerManager.instance.requestApproval({
              requestId,
              toolName: confirmation.toolName,
              title: confirmation.title,
              message: confirmation.message,
              diff: confirmation.diff,
              command: confirmation.command,
            });

            if (!approved) {
              // User rejected the tool execution
              console.log(`[ToolHandler] User REJECTED ${toolName} execution`);
              const response: ToolExecutionResponse = {
                type: 'toolExecutionResult',
                requestId,
                result: {
                  success: false,
                  error: 'REJECTED_BY_USER',
                }
              };
              webviewView.webview.postMessage(response);
              return;
            }
            // User approved - continue to execute the tool
            console.log(`[ToolHandler] User approved ${toolName} execution in Manual Mode`);
          }
        } catch (approvalError) {
          console.error('[ToolHandler] Approval request failed:', approvalError);
          const response: ToolExecutionResponse = {
            type: 'toolExecutionResult',
            requestId,
            result: {
              success: false,
              error: `Approval request failed: ${approvalError instanceof Error ? approvalError.message : 'Unknown error'}`,
            }
          };
          webviewView.webview.postMessage(response);
          return;
        }
      }
    }

    // Execute tool with cancellation signal and mode
    console.log(
      `[ToolHandler] EXEC ${requestId} tool=${toolName} mode=${mode ?? 'default'} params=${formatToolExecutionDebug(toolName, parameters)}`
    );
    const result = await tool.execute(parameters, onProgress, abortController.signal, mode);
    console.log(
      `[ToolHandler] DONE ${requestId} tool=${toolName} success=${result.success} error=${result.error ?? ''}`
    );

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

      // Trigger refactor scan ONLY for write_to_file and edit, as requested
      if (onFileModificationSuccess && (toolName === 'write_to_file' || toolName === 'edit')) {
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
