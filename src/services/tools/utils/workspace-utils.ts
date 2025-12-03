import * as vscode from 'vscode';
import * as path from 'path';

export function getWorkspaceRoot(): string | null {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return null;
  }
  return workspaceFolders[0].uri.fsPath;
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
