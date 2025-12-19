import * as vscode from 'vscode';
import * as path from 'path';

export function getWorkspaceRoot(): string | null {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return null;
  }
  return workspaceFolders[0].uri.fsPath;
}

export function getAllWorkspaceFolders(): readonly vscode.WorkspaceFolder[] {
  return vscode.workspace.workspaceFolders || [];
}

export function getWorkspaceFolderByName(name: string): vscode.WorkspaceFolder | undefined {
  return vscode.workspace.workspaceFolders?.find(folder => folder.name === name);
}

/**
 * Check if a path is within the workspace root (prevents path traversal attacks)
 */
export function isPathWithinWorkspace(absolutePath: string, workspaceRoot: string): boolean {
  const normalizedPath = path.normalize(absolutePath);
  const normalizedRoot = path.normalize(workspaceRoot);
  
  // Ensure the path starts with the workspace root
  return normalizedPath.startsWith(normalizedRoot + path.sep) || normalizedPath === normalizedRoot;
}

/**
 * Check if a path is within ANY active workspace folder
 */
export function isPathWithinAnyWorkspace(absolutePath: string): boolean {
  const folders = getAllWorkspaceFolders();
  return folders.some(folder => isPathWithinWorkspace(absolutePath, folder.uri.fsPath));
}

/**
 * Get the workspace folder that contains the given path
 */
export function getWorkspaceFolderForPath(absolutePath: string): vscode.WorkspaceFolder | undefined {
  const folders = getAllWorkspaceFolders();
  // Sort by length descending to match the most specific (nested) workspace first
  const sortedFolders = [...folders].sort((a, b) => b.uri.fsPath.length - a.uri.fsPath.length);
  
  return sortedFolders.find(folder => isPathWithinWorkspace(absolutePath, folder.uri.fsPath));
}

/**
 * Resolve a path relative to workspace root, ensuring it stays within the workspace.
 * Returns workspaceRoot if the path would escape the workspace.
 */
export function resolveAbsolutePath(filePath: string, workspaceRoot: string): string {
  // If absolute path, validate it's within workspace
  if (path.isAbsolute(filePath)) {
    const normalizedPath = path.normalize(filePath);
    if (isPathWithinWorkspace(normalizedPath, workspaceRoot)) {
      return normalizedPath;
    }
    // Path is outside workspace - return workspace root instead
    console.warn(`[Security] Blocked path outside workspace: ${filePath}`);
    return workspaceRoot;
  }
  
  // For relative paths, resolve and validate
  const resolved = path.normalize(path.join(workspaceRoot, filePath));
  
  // Check for path traversal (e.g., "../../../etc/passwd")
  if (!isPathWithinWorkspace(resolved, workspaceRoot)) {
    console.warn(`[Security] Blocked path traversal attempt: ${filePath}`);
    return workspaceRoot;
  }
  
  return resolved;
}

/**
 * Resolve a path across multiple workspaces.
 * Handles:
 * 1. "WorkspaceName/path/to/file" format
 * 2. Absolute paths checking against all workspaces
 * 3. Relative paths (defaults to first workspace)
 */
export function resolveMultiRootPath(filePath: string): string {
  const folders = getAllWorkspaceFolders();
  if (folders.length === 0) {
    return filePath;
  }

  // 1. Handle "WorkspaceName/..." format if multiple workspaces exist
  if (folders.length > 1) {
    const parts = filePath.split(/[/\\]/);
    const potentialWorkspaceName = parts[0];
    const targetWorkspace = folders.find(w => w.name === potentialWorkspaceName);
    
    if (targetWorkspace) {
      // Remove workspace name from path and resolve against that workspace
      const relativePath = parts.slice(1).join(path.sep);
      // If path was just "WorkspaceName", return the root
      if (parts.length === 1) {
        return targetWorkspace.uri.fsPath;
      }
      return resolveAbsolutePath(relativePath, targetWorkspace.uri.fsPath);
    }
  }

  // 2. Handle Absolute Paths
  if (path.isAbsolute(filePath)) {
    if (isPathWithinAnyWorkspace(filePath)) {
      return path.normalize(filePath);
    }
    // Security fallback
    return folders[0].uri.fsPath;
  }

  // 3. Default: Relative to first workspace
  return resolveAbsolutePath(filePath, folders[0].uri.fsPath);
}

export async function getCreatedDirectories(
  filePath: string,
  workspaceRoot: string
): Promise<string[]> {
  const absolutePath = resolveAbsolutePath(filePath, workspaceRoot);
  const dirPath = path.dirname(absolutePath);
  const createdDirs: string[] = [];
  
  let currentPath = dirPath;
  
  while (currentPath !== workspaceRoot && currentPath.length > workspaceRoot.length) {
    try {
      const dirUri = vscode.Uri.file(currentPath);
      await vscode.workspace.fs.stat(dirUri);
      break;
    } catch {
      createdDirs.push(currentPath);
      currentPath = path.dirname(currentPath);
    }
  }
  
  return createdDirs.reverse();
}
