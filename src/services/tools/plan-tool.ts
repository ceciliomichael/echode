import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';
import { ITool, ToolExecutionResult } from './tool.interface';

/**
 * Generate a short 8-character ID using Node's crypto module
 * Matches the format used by code review reports
 */
function generateShortId(): string {
  return crypto.randomUUID().slice(0, 8);
}

/**
 * Plan Tool
 * 
 * A tool exclusive to plan mode that supports three modes:
 * - create_plan: Create a markdown plan and open it in VS Code (shows "Verify Plan" button)
 * - update_plan: Update an existing plan file when user provides feedback (shows "Verify Plan" button)
 * - handoff: Prepare to hand off to agent mode (shows "Start Implementation" button)
 * 
 * IMPORTANT: This tool returns `awaitsUserAction: true` which signals the frontend
 * to stop execution and wait for user interaction before continuing.
 */

export type PlanMode = 'create_plan' | 'update_plan' | 'handoff';

export interface PlanToolParameters {
  mode: PlanMode;
  plan?: string;             // For 'create_plan' and 'update_plan' modes (markdown content)
  title?: string;            // For 'create_plan' and 'update_plan' modes (plan title)
  planFilePath?: string;     // For 'update_plan' mode (existing plan file path)
  summary?: string;          // For 'handoff' mode
}

export interface PlanToolResult {
  mode: PlanMode;
  awaitsUserAction: boolean;
  actionType: 'verify_plan' | 'start_implementation';
  planTitle?: string;
  planContent?: string;
  planFilePath?: string;     // Path to saved plan file for undo/delete
  summary?: string;
  message: string;
}

export class PlanTool implements ITool {
  name = 'plan';

  async execute(parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
    try {
      const params = parameters as unknown as PlanToolParameters;
      const mode = params.mode;

      if (!mode || !['create_plan', 'update_plan', 'handoff'].includes(mode)) {
        return {
          success: false,
          error: 'Invalid mode. Must be one of: create_plan, update_plan, handoff',
        };
      }

      switch (mode) {
        case 'create_plan':
          return this.handleCreatePlanMode(params);
        case 'update_plan':
          return this.handleUpdatePlanMode(params);
        case 'handoff':
          return this.handleHandoffMode(params);
        default:
          return {
            success: false,
            error: `Unknown mode: ${mode}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: `Plan tool error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Create plan mode: Generate a markdown plan and save to .echode/plan-uuid.md
   * Shows "Verify Plan" button
   */
  private async handleCreatePlanMode(params: PlanToolParameters): Promise<ToolExecutionResult> {
    const planContent = params.plan;
    const title = params.title || 'Implementation Plan';

    if (!planContent || typeof planContent !== 'string' || planContent.trim().length === 0) {
      return {
        success: false,
        error: 'Create plan mode requires a non-empty "plan" parameter with markdown content',
      };
    }

    try {
      const fullContent = `# ${title}\n\n${planContent}`;
      
      // Get workspace folder
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        return {
          success: false,
          error: 'No workspace folder open. Cannot save plan file.',
        };
      }

      const workspaceRoot = workspaceFolders[0].uri.fsPath;
      const planDir = path.join(workspaceRoot, '.echode', 'plan');
      const planId = generateShortId();
      const planFileName = `plan-${planId}.md`;
      const planFilePath = path.join(planDir, planFileName);

      // Ensure .echode/plan directory exists
      const planDirUri = vscode.Uri.file(planDir);
      try {
        await vscode.workspace.fs.stat(planDirUri);
      } catch {
        // Directory doesn't exist, create it (creates parent dirs too)
        await vscode.workspace.fs.createDirectory(planDirUri);
      }

      // Write the plan file
      const planFileUri = vscode.Uri.file(planFilePath);
      await vscode.workspace.fs.writeFile(planFileUri, Buffer.from(fullContent, 'utf-8'));

      // Open the saved plan file in editor
      const document = await vscode.workspace.openTextDocument(planFileUri);
      await vscode.window.showTextDocument(document, {
        preview: false,
        preserveFocus: true, // Keep focus on sidebar
      });

      const result: PlanToolResult = {
        mode: 'create_plan',
        awaitsUserAction: true,
        actionType: 'verify_plan',
        planTitle: title,
        planContent: fullContent,
        planFilePath: planFilePath, // Store path for undo/delete
        message: `Plan "${title}" saved to .echode/plan/${planFileName}. Click "Verify Plan" to continue.`,
      };

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to save plan document: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Update plan mode: Update an existing plan file when user provides feedback
   * Shows "Verify Plan" button
   */
  private async handleUpdatePlanMode(params: PlanToolParameters): Promise<ToolExecutionResult> {
    const planContent = params.plan;
    const title = params.title || 'Implementation Plan';
    let existingPlanFilePath = params.planFilePath;

    if (!planContent || typeof planContent !== 'string' || planContent.trim().length === 0) {
      return {
        success: false,
        error: 'Update plan mode requires a non-empty "plan" parameter with markdown content',
      };
    }

    try {
      // If no path provided, try to find the latest plan file
      if (!existingPlanFilePath || typeof existingPlanFilePath !== 'string') {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
          const workspaceRoot = workspaceFolders[0].uri.fsPath;
          const planDir = path.join(workspaceRoot, '.echode', 'plan');
          const planDirUri = vscode.Uri.file(planDir);

          try {
            const files = await vscode.workspace.fs.readDirectory(planDirUri);
            const planFiles = files.filter(([name]) => name.startsWith('plan-') && name.endsWith('.md'));

            if (planFiles.length > 0) {
              // Get stats for all plan files to find the most recent one
              const fileStats = await Promise.all(
                planFiles.map(async ([name]) => {
                  const filePath = path.join(planDir, name);
                  const stat = await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
                  return { path: filePath, mtime: stat.mtime };
                })
              );

              // Sort by mtime descending (newest first)
              fileStats.sort((a, b) => b.mtime - a.mtime);
              existingPlanFilePath = fileStats[0].path;
            }
          } catch (error) {
            // Ignore errors reading directory, fall back to validation error
            console.error('Failed to search for plan files:', error);
          }
        }
      }

      if (!existingPlanFilePath || typeof existingPlanFilePath !== 'string') {
        return {
          success: false,
          error: 'Update plan mode requires a valid "planFilePath" parameter. Could not automatically find an existing plan to update.',
        };
      }

      const fullContent = `# ${title}\n\n${planContent}`;
      
      // Check if the file exists
      const planFileUri = vscode.Uri.file(existingPlanFilePath);
      try {
        await vscode.workspace.fs.stat(planFileUri);
      } catch {
        return {
          success: false,
          error: `Plan file not found at: ${existingPlanFilePath}. Use create_plan mode instead.`,
        };
      }

      // Update the existing plan file
      await vscode.workspace.fs.writeFile(planFileUri, Buffer.from(fullContent, 'utf-8'));

      // Open the updated plan file in editor
      const document = await vscode.workspace.openTextDocument(planFileUri);
      await vscode.window.showTextDocument(document, {
        preview: false,
        preserveFocus: true,
      });

      const planFileName = path.basename(existingPlanFilePath);
      const result: PlanToolResult = {
        mode: 'update_plan',
        awaitsUserAction: true,
        actionType: 'verify_plan',
        planTitle: title,
        planContent: fullContent,
        planFilePath: existingPlanFilePath,
        message: `Plan "${title}" updated at .echode/${planFileName}. Click "Verify Plan" to continue.`,
      };

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to update plan document: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Handoff mode: Prepare to switch to agent mode
   * Shows "Start Implementation" button
   */
  private handleHandoffMode(params: PlanToolParameters): ToolExecutionResult {
    const summary = params.summary;

    const result: PlanToolResult = {
      mode: 'handoff',
      awaitsUserAction: true,
      actionType: 'start_implementation',
      summary,
      message: summary 
        ? `Ready to implement: ${summary}. Click "Start Implementation" to switch to Agent mode.`
        : 'Ready to implement. Click "Start Implementation" to switch to Agent mode.',
    };

    return {
      success: true,
      data: result,
    };
  }
}
