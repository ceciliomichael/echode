import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';
import { ITool, ToolExecutionResult } from './tool.interface';
import { PlanViewerManager } from '../plan-viewer/plan-viewer-manager';

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
  planFilePath?: string;           // Path to saved plan file for undo/delete
  previousPlanContent?: string;    // Previous content for undo (update_plan mode only)
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

      // Open plan in custom viewer
      if (PlanViewerManager.isInitialized) {
        PlanViewerManager.instance.openPlan(title, fullContent, planFilePath);
      }

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
      // Auto-discover the latest plan file if path is not provided
      if (!existingPlanFilePath || typeof existingPlanFilePath !== 'string') {
        // First check if we have a tracked plan in the viewer manager (persistent across reloads)
        if (PlanViewerManager.isInitialized) {
          const trackedPath = PlanViewerManager.instance.getCurrentPlanPath();
          if (trackedPath) {
            existingPlanFilePath = trackedPath;
          }
        }
      }

      // If still not found, try to find the latest file in the directory
      if (!existingPlanFilePath || typeof existingPlanFilePath !== 'string') {
        try {
          const workspaceFolders = vscode.workspace.workspaceFolders;
          if (workspaceFolders && workspaceFolders.length > 0) {
            const workspaceRoot = workspaceFolders[0].uri.fsPath;
            const planDir = path.join(workspaceRoot, '.echode', 'plan');
            const planDirUri = vscode.Uri.file(planDir);
            
            // Read directory to find .md files
            const files = await vscode.workspace.fs.readDirectory(planDirUri);
            const mdFiles = files.filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.md'));
            
            if (mdFiles.length > 0) {
              // Find the most recently modified file
              let latestFile = '';
              let latestMtime = 0;
              
              for (const [name] of mdFiles) {
                const filePath = path.join(planDir, name);
                const stat = await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
                if (stat.mtime > latestMtime) {
                  latestMtime = stat.mtime;
                  latestFile = filePath;
                }
              }
              
              if (latestFile) {
                existingPlanFilePath = latestFile;
              }
            }
          }
        } catch (error) {
          // Ignore errors during auto-discovery (e.g., directory doesn't exist)
          console.error('Failed to auto-discover plan file:', error);
        }
      }

      if (!existingPlanFilePath || typeof existingPlanFilePath !== 'string') {
        return {
          success: false,
          error: 'Update plan mode requires a valid "planFilePath" parameter. Could not automatically find an existing plan to update.',
        };
      }

      const fullContent = `# ${title}\n\n${planContent}`;
      
      // Check if the file exists and read previous content for undo support
      const planFileUri = vscode.Uri.file(existingPlanFilePath);
      let previousPlanContent: string | undefined;
      try {
        const existingContent = await vscode.workspace.fs.readFile(planFileUri);
        previousPlanContent = Buffer.from(existingContent).toString('utf-8');
      } catch {
        return {
          success: false,
          error: `Plan file not found at: ${existingPlanFilePath}. Use create_plan mode instead.`,
        };
      }

      // Update the existing plan file
      await vscode.workspace.fs.writeFile(planFileUri, Buffer.from(fullContent, 'utf-8'));

      // Open plan in custom viewer
      if (PlanViewerManager.isInitialized) {
        PlanViewerManager.instance.openPlan(title, fullContent, existingPlanFilePath);
      }

      const planFileName = path.basename(existingPlanFilePath);
      const result: PlanToolResult = {
        mode: 'update_plan',
        awaitsUserAction: true,
        actionType: 'verify_plan',
        planTitle: title,
        planContent: fullContent,
        planFilePath: existingPlanFilePath,
        previousPlanContent,  // Store previous content for undo support
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
   * 
   * Note: planContent and planFilePath come from the frontend which tracks them
   * from the original create_plan/update_plan tool result in the conversation.
   * The handoff tool itself doesn't need to look them up - they're passed through
   * the tool result chain to maintain session-specific context.
   */
  private handleHandoffMode(params: PlanToolParameters): ToolExecutionResult {
    const summary = params.summary;
    
    // Auto-discover the latest plan file to pass to agent mode
    let planFilePath: string | undefined;
    if (PlanViewerManager.isInitialized) {
      planFilePath = PlanViewerManager.instance.getCurrentPlanPath();
    }

    const result: PlanToolResult = {
      mode: 'handoff',
      awaitsUserAction: true,
      actionType: 'start_implementation',
      planFilePath, // Pass the tracked plan path to the agent
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
