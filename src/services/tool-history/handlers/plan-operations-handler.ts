import * as vscode from 'vscode';
import type { IToolHistoryHandler } from './handler.interface';
import type { ToolHistoryResult, ToolDataRecord } from '../types';
import { PlanViewerManager } from '../../plan-viewer/plan-viewer-manager';

/**
 * Handler for plan tool operations
 * Handles undo/redo of plan file creation and updates
 * 
 * Smart Undo Logic:
 * - create_plan: Delete the file (undo creation)
 * - update_plan: Restore previous content (undo update)
 * - handoff: No file operation needed
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

    const mode = data.mode as string | undefined;
    const planFilePath = data.planFilePath as string | undefined;
    
    // No file path means nothing to undo (handoff mode or missing data)
    if (!planFilePath) {
      return { success: true };
    }

    // Handle based on mode
    if (mode === 'update_plan') {
      return this.undoUpdatePlan(planFilePath, data);
    } else if (mode === 'create_plan') {
      return this.undoCreatePlan(planFilePath);
    }
    
    // Unknown or handoff mode - nothing to do
    return { success: true };
  }

  /**
   * Undo a plan update by restoring the previous content
   */
  private async undoUpdatePlan(
    planFilePath: string,
    data: ToolDataRecord
  ): Promise<ToolHistoryResult> {
    const previousPlanContent = data.previousPlanContent as string | undefined;
    
    // If no previous content stored (legacy history), do NOT delete - just skip
    if (!previousPlanContent) {
      console.warn(
        `[PlanOperationsHandler] Cannot undo update_plan: no previousPlanContent stored. ` +
        `File will remain at current state: ${planFilePath}`
      );
      return { success: true };
    }

    try {
      const uri = vscode.Uri.file(planFilePath);
      
      // Restore the previous content
      await vscode.workspace.fs.writeFile(uri, Buffer.from(previousPlanContent, 'utf-8'));
      console.log(`[PlanOperationsHandler] Restored previous plan content: ${planFilePath}`);
      
      // Update the plan viewer if open
      if (PlanViewerManager.isInitialized) {
        const planTitle = (data.planTitle as string) || 'Implementation Plan';
        PlanViewerManager.instance.openPlan(planTitle, previousPlanContent, planFilePath);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to restore previous plan: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Undo a plan creation by deleting the file
   */
  private async undoCreatePlan(planFilePath: string): Promise<ToolHistoryResult> {
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