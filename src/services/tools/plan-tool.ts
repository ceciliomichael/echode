import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';
import { ITool, ToolExecutionResult } from './tool.interface';

/**
 * Generate a UUID v4 using Node's crypto module
 */
function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Plan Tool
 * 
 * A tool exclusive to plan mode that supports three modes:
 * - ask: Display clarifying questions to the user (no button, just stops)
 * - create_plan: Create a markdown plan and open it in VS Code (shows "Verify Plan" button)
 * - handoff: Prepare to hand off to agent mode (shows "Start Implementation" button)
 * 
 * IMPORTANT: This tool returns `awaitsUserAction: true` which signals the frontend
 * to stop execution and wait for user interaction before continuing.
 */

export type PlanMode = 'ask' | 'create_plan' | 'handoff';

export interface PlanToolParameters {
  mode: PlanMode;
  questions?: string[];      // For 'ask' mode
  plan?: string;             // For 'create_plan' mode (markdown content)
  title?: string;            // For 'create_plan' mode (plan title)
  summary?: string;          // For 'handoff' mode
}

export interface PlanToolResult {
  mode: PlanMode;
  awaitsUserAction: boolean;
  actionType: 'none' | 'verify_plan' | 'start_implementation';
  questions?: string[];
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

      if (!mode || !['ask', 'create_plan', 'handoff'].includes(mode)) {
        return {
          success: false,
          error: 'Invalid mode. Must be one of: ask, create_plan, handoff',
        };
      }

      switch (mode) {
        case 'ask':
          return this.handleAskMode(params);
        case 'create_plan':
          return this.handleCreatePlanMode(params);
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
   * Ask mode: Display questions to the user
   * No button needed - just displays questions and stops
   */
  private handleAskMode(params: PlanToolParameters): ToolExecutionResult {
    const questions = params.questions;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return {
        success: false,
        error: 'Ask mode requires a non-empty "questions" array',
      };
    }

    const result: PlanToolResult = {
      mode: 'ask',
      awaitsUserAction: true,
      actionType: 'none',
      questions,
      message: `Displaying ${questions.length} question(s) for clarification`,
    };

    return {
      success: true,
      data: result,
    };
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
      const echodeDir = path.join(workspaceRoot, '.echode');
      const planId = generateUUID();
      const planFileName = `plan-${planId}.md`;
      const planFilePath = path.join(echodeDir, planFileName);

      // Ensure .echode directory exists
      const echodeDirUri = vscode.Uri.file(echodeDir);
      try {
        await vscode.workspace.fs.stat(echodeDirUri);
      } catch {
        // Directory doesn't exist, create it
        await vscode.workspace.fs.createDirectory(echodeDirUri);
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
        message: `Plan "${title}" saved to .echode/${planFileName}. Click "Verify Plan" to continue.`,
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
   * Handoff mode: Prepare to switch to agent mode
   * Shows "Start Implementation" button
   */
  private handleHandoffMode(params: PlanToolParameters): ToolExecutionResult {
    const summary = params.summary || 'Ready to start implementation';

    const result: PlanToolResult = {
      mode: 'handoff',
      awaitsUserAction: true,
      actionType: 'start_implementation',
      summary,
      message: 'Click "Start Implementation" to switch to Agent mode and begin development.',
    };

    return {
      success: true,
      data: result,
    };
  }
}