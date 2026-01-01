import * as vscode from 'vscode';
import * as path from 'path';
import { getGlobalWorkflowsDir, getWorkspaceWorkflowsDir } from '../../utils/workflow-paths';

/**
 * Workflow Handler
 * Handles file I/O operations for workflow files in .echode/workflows/
 * Supports both workspace-level and global (user home) workflows
 */

export type WorkflowSource = 'workspace' | 'global';

export interface WorkflowData {
  name: string;
  content: string;
  source: WorkflowSource;
}

interface SaveWorkflowRequest {
  name: string;
  content: string;
  source: WorkflowSource;
}

interface DeleteWorkflowRequest {
  name: string;
  source: WorkflowSource;
}

type WebviewTarget = vscode.WebviewView | vscode.WebviewPanel;

/**
 * Get the workspace root path
 */
function getWorkspaceRoot(): string | undefined {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  return workspaceFolders && workspaceFolders.length > 0
    ? workspaceFolders[0].uri.fsPath
    : undefined;
}

/**
 * Ensure a directory exists, creating it if necessary
 */
async function ensureDirectoryExists(dirPath: string): Promise<void> {
  const dirUri = vscode.Uri.file(dirPath);
  
  try {
    await vscode.workspace.fs.stat(dirUri);
  } catch {
    // Directory doesn't exist, create it
    await vscode.workspace.fs.createDirectory(dirUri);
  }
}

/**
 * Read workflows from a specific directory
 */
async function readWorkflowsFromDir(
  dirPath: string,
  source: WorkflowSource
): Promise<WorkflowData[]> {
  const workflows: WorkflowData[] = [];
  const dirUri = vscode.Uri.file(dirPath);
  
  try {
    await ensureDirectoryExists(dirPath);
    const entries = await vscode.workspace.fs.readDirectory(dirUri);
    
    for (const [filename, fileType] of entries) {
      if (fileType === vscode.FileType.File && filename.endsWith('.md')) {
        const fileUri = vscode.Uri.file(path.join(dirPath, filename));
        try {
          const contentBuffer = await vscode.workspace.fs.readFile(fileUri);
          const content = Buffer.from(contentBuffer).toString('utf-8');
          const name = filename.slice(0, -3); // Remove .md extension
          workflows.push({ name, content, source });
        } catch (readError) {
          console.error(`[WorkflowHandler] Error reading file ${filename}:`, readError);
        }
      }
    }
  } catch (error) {
    // Directory might not exist or be inaccessible, return empty array
    console.error(`[WorkflowHandler] Error reading directory ${dirPath}:`, error);
  }
  
  return workflows;
}

/**
 * Convert a string to kebab-case for use as a filename
 */
function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')          // Replace spaces with hyphens
    .replace(/-+/g, '-')           // Replace multiple hyphens with single
    .replace(/^-|-$/g, '');        // Remove leading/trailing hyphens
}

/**
 * Handle get all workflows request
 * Returns list of all workflow files from both workspace and global directories
 */
export async function handleGetWorkflows(
  _data: unknown,
  webview: WebviewTarget
): Promise<void> {
  try {
    const allWorkflows: WorkflowData[] = [];
    
    // Read workspace workflows (if workspace is open)
    const workspaceRoot = getWorkspaceRoot();
    if (workspaceRoot) {
      const workspaceDir = getWorkspaceWorkflowsDir(workspaceRoot);
      const workspaceWorkflows = await readWorkflowsFromDir(workspaceDir, 'workspace');
      allWorkflows.push(...workspaceWorkflows);
    }
    
    // Read global workflows
    const globalDir = getGlobalWorkflowsDir();
    const globalWorkflows = await readWorkflowsFromDir(globalDir, 'global');
    allWorkflows.push(...globalWorkflows);
    
    // Sort workflows alphabetically by name within each source
    allWorkflows.sort((a, b) => {
      // First sort by source (workspace first, then global)
      if (a.source !== b.source) {
        return a.source === 'workspace' ? -1 : 1;
      }
      // Then sort by name
      return a.name.localeCompare(b.name);
    });
    
    webview.webview.postMessage({
      type: 'workflowsList',
      workflows: allWorkflows
    });
  } catch (error) {
    console.error('[WorkflowHandler] Error getting workflows:', error);
    webview.webview.postMessage({
      type: 'workflowsList',
      workflows: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Handle save workflow request
 * Creates or updates a workflow file in workspace or global directory
 */
export async function handleSaveWorkflow(
  data: SaveWorkflowRequest,
  webview: WebviewTarget
): Promise<void> {
  const { name, content, source = 'workspace' } = data;
  
  // Validate input
  if (!name || !name.trim()) {
    webview.webview.postMessage({
      type: 'workflowSaved',
      success: false,
      error: 'Workflow name is required'
    });
    return;
  }

  if (!content || !content.trim()) {
    webview.webview.postMessage({
      type: 'workflowSaved',
      success: false,
      error: 'Workflow content is required'
    });
    return;
  }

  // For workspace source, require an open workspace
  if (source === 'workspace') {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
      webview.webview.postMessage({
        type: 'workflowSaved',
        success: false,
        error: 'No workspace folder open. Use Global to save without a workspace.'
      });
      return;
    }
  }

  try {
    // Sanitize filename to kebab-case
    const sanitizedName = toKebabCase(name);
    
    if (!sanitizedName) {
      webview.webview.postMessage({
        type: 'workflowSaved',
        success: false,
        error: 'Invalid workflow name after sanitization'
      });
      return;
    }
    
    // Determine target directory based on source
    const workflowsDir = source === 'global' 
      ? getGlobalWorkflowsDir()
      : getWorkspaceWorkflowsDir(getWorkspaceRoot()!);
    
    await ensureDirectoryExists(workflowsDir);
    
    const filePath = path.join(workflowsDir, `${sanitizedName}.md`);
    const fileUri = vscode.Uri.file(filePath);
    
    // Write the file
    const contentBuffer = Buffer.from(content, 'utf-8');
    await vscode.workspace.fs.writeFile(fileUri, contentBuffer);
    
    webview.webview.postMessage({
      type: 'workflowSaved',
      success: true,
      name: sanitizedName,
      source
    });
  } catch (error) {
    console.error('[WorkflowHandler] Error saving workflow:', error);
    webview.webview.postMessage({
      type: 'workflowSaved',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Handle delete workflow request
 * Deletes a workflow file from workspace or global directory
 */
export async function handleDeleteWorkflow(
  data: DeleteWorkflowRequest,
  webview: WebviewTarget
): Promise<void> {
  const { name, source = 'workspace' } = data;
  
  if (!name) {
    webview.webview.postMessage({
      type: 'workflowDeleted',
      success: false,
      error: 'Workflow name is required'
    });
    return;
  }

  // For workspace source, require an open workspace
  if (source === 'workspace') {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
      webview.webview.postMessage({
        type: 'workflowDeleted',
        success: false,
        error: 'No workspace folder open'
      });
      return;
    }
  }

  try {
    // Determine target directory based on source
    const workflowsDir = source === 'global' 
      ? getGlobalWorkflowsDir()
      : getWorkspaceWorkflowsDir(getWorkspaceRoot()!);
    
    const filePath = path.join(workflowsDir, `${name}.md`);
    const fileUri = vscode.Uri.file(filePath);
    
    await vscode.workspace.fs.delete(fileUri);
    
    webview.webview.postMessage({
      type: 'workflowDeleted',
      success: true,
      name,
      source
    });
  } catch (error) {
    console.error('[WorkflowHandler] Error deleting workflow:', error);
    webview.webview.postMessage({
      type: 'workflowDeleted',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}