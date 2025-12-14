import * as vscode from 'vscode';
import type { ToolHistoryService } from '../../services/tool-history';
import type { ToolExecutionState } from '../../types/tool-execution';

/**
 * Tool History Handler
 * Handles undo/redo operations for tool executions
 */

interface ToolHistoryData {
  requestId: string;
  toolExecutions: [string, ToolExecutionState][];
}

/**
 * Get current workspace path
 */
function getWorkspacePath(): string {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  return workspaceFolders && workspaceFolders.length > 0
    ? workspaceFolders[0].uri.fsPath
    : '';
}

/**
 * Undo tool executions
 */
export async function handleUndoToolExecutions(
  data: ToolHistoryData,
  webview: vscode.WebviewView,
  toolHistoryService: ToolHistoryService
): Promise<void> {
  const workspacePath = getWorkspacePath();

  try {
    const toolExecutions = new Map<string, ToolExecutionState>(data.toolExecutions);
    const result = await toolHistoryService.undoToolExecutions(
      toolExecutions,
      workspacePath
    );
    webview.webview.postMessage({
      type: 'toolExecutionsUndone',
      requestId: data.requestId,
      success: result.success,
      errors: result.errors,
    });
  } catch (error) {
    console.error('[ToolHistory] Error undoing tool executions:', error);
    webview.webview.postMessage({
      type: 'toolExecutionsError',
      error: error instanceof Error ? error.message : 'Failed to undo tool executions',
      requestId: data.requestId,
    });
  }
}

/**
 * Redo tool executions
 */
export async function handleRedoToolExecutions(
  data: ToolHistoryData,
  webview: vscode.WebviewView,
  toolHistoryService: ToolHistoryService
): Promise<void> {
  const workspacePath = getWorkspacePath();

  try {
    const toolExecutions = new Map<string, ToolExecutionState>(data.toolExecutions);
    const result = await toolHistoryService.redoToolExecutions(
      toolExecutions,
      workspacePath
    );
    webview.webview.postMessage({
      type: 'toolExecutionsRedone',
      requestId: data.requestId,
      success: result.success,
      errors: result.errors,
    });
  } catch (error) {
    console.error('[ToolHistory] Error redoing tool executions:', error);
    webview.webview.postMessage({
      type: 'toolExecutionsError',
      error: error instanceof Error ? error.message : 'Failed to redo tool executions',
      requestId: data.requestId,
    });
  }
}