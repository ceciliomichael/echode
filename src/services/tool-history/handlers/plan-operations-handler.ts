import * as vscode from 'vscode';
import type { IToolHistoryHandler } from './handler.interface';
import type { ToolHistoryResult, ToolDataRecord } from '../types';
import { PlanViewerManager } from '../../plan-viewer/plan-viewer-manager';

/**
 * Handler for plan tool operations
 * Handles undo/redo of plan file creation
 */
export class PlanOperationsHandler implements IToolHistoryHandler {
  readonly supportedTools = ['plan'];

  async undo(
    toolName: string,
    data: ToolDataRecord,
    _workspacePath: string
  ): Promise<ToolHistoryResult> {
    if (toolName !== 'plan') {
      return { success: true };
    }

    // Get the plan file path from the tool result data
    const planFilePath = data.planFilePath as string | undefined;
    
    // Only delete if we have a plan file path (create_plan mode)
    if (!planFilePath) {
      // No file to delete (ask or handoff mode)
      return { success: true };
    }

    try {
      const uri = vscode.Uri.file(planFilePath);
      
      // Close any tabs that have this file open
      const targetUri = uri.toString();
      const tabsToClose: vscode.Tab[] = [];

      for (const tabGroup of vscode.window.tabGroups.all) {
        for (const tab of tabGroup.tabs) {
          const tabInput = tab.input;
          if (tabInput && typeof tabInput === 'object' && 'uri' in tabInput && tabInput.uri) {
            if (tabInput.uri.toString() === targetUri) {
              tabsToClose.push(tab);
            }
          }
        }
      }

      // Close all found tabs
      if (tabsToClose.length > 0) {
        await vscode.window.tabGroups.close(tabsToClose);
        console.log(`[PlanOperationsHandler] Closed ${tabsToClose.length} tab(s) for plan file`);
      }

      // Delete the plan file
      await vscode.workspace.fs.delete(uri, { recursive: false, useTrash: false });
      console.log(`[PlanOperationsHandler] Deleted plan file: ${planFilePath}`);

      return { success: true };
    } catch (error) {
      // If file doesn't exist, that's fine
      if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
        return { success: true };
      }
      
      return {
        success: false,
        error: `Failed to delete plan file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async redo(
    toolName: string,
    data: ToolDataRecord,
    _workspacePath: string
  ): Promise<ToolHistoryResult> {
    if (toolName !== 'plan') {
      return { success: true };
    }

    // Get plan details from the tool result data
    const planFilePath = data.planFilePath as string | undefined;
    const planContent = data.planContent as string | undefined;

    // Only recreate if we have both path and content (create_plan mode)
    if (!planFilePath || !planContent) {
      return { success: true };
    }

    try {
      const uri = vscode.Uri.file(planFilePath);
      
      // Write the plan file
      await vscode.workspace.fs.writeFile(uri, Buffer.from(planContent, 'utf-8'));
      
      // Open plan in custom viewer
      if (PlanViewerManager.isInitialized) {
        const planTitle = (data.planTitle as string) || 'Implementation Plan';
        PlanViewerManager.instance.openPlan(planTitle, planContent, planFilePath);
      }

      console.log(`[PlanOperationsHandler] Recreated plan file: ${planFilePath}`);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to recreate plan file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}