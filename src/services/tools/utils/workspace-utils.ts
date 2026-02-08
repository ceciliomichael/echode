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
 * Get the workspace folder that contains the given file path
 */
export function getWorkspaceRootForPath(filePath: string): string | null {
  const folders = getAllWorkspaceFolders();

  // Normalize path for comparison
  const normalizedFilePath = path.normalize(filePath);

  // Find the folder that contains this path
  // Sort by length descending to match the most specific (longest) path first
  // (though in VS Code workspaces are usually distinct, but nested workspaces are possible)
  const matchingFolder = [...folders]
    .sort((a, b) => b.uri.fsPath.length - a.uri.fsPath.length)
    .find(folder => {
      const folderPath = path.normalize(folder.uri.fsPath);
      // Check if file is inside folder (or is the folder itself)
      return normalizedFilePath.startsWith(folderPath + path.sep) || normalizedFilePath === folderPath;
    });

  return matchingFolder ? matchingFolder.uri.fsPath : null;
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
 * Resolve a path relative to workspace root, ensuring it stays within the workspace.
 * Returns workspaceRoot if the path would escape the workspace.
 */
export function resolveAbsolutePath(filePath: string, defaultWorkspaceRoot: string): string {
  // Sanitize path: trim whitespace
  let cleanPath = filePath.trim();

  // Remove trailing slashes (e.g. "file.ts/") unless it's a root path
  // Guard against removing root slash (e.g. "C:\" or "/")
  if (cleanPath.length > 3 && /[/\\]$/.test(cleanPath)) {
    cleanPath = cleanPath.replace(/[/\\]+$/, '');
  }

  // If absolute path, validate it's within ANY workspace
  if (path.isAbsolute(cleanPath)) {
    const normalizedPath = path.normalize(cleanPath);

    // Check if it's in any open workspace
    if (isPathWithinAnyWorkspace(normalizedPath)) {
      return normalizedPath;
    }

    // Path is outside all workspaces - return default workspace root
    console.warn(`[Security] Blocked path outside workspace: ${cleanPath}`);
    return defaultWorkspaceRoot;
  }

  // Check for Multi-Root Prefixes ("ProjectName/path/to/file")
  // This aligns behavior with PathResolver and allows relative paths targeting specific workspaces
  const folders = getAllWorkspaceFolders();
  const parts = cleanPath.split(/[/\\]/);
  const potentialPrefix = parts[0];

  const matchedFolder = folders.find(f => f.name === potentialPrefix);
  if (matchedFolder) {
    // Strip the prefix and join with that folder's root
    const relPath = parts.slice(1).join(path.sep);
    // If relPath is empty (just "ProjectName"), it targets the root
    const resolved = path.normalize(path.join(matchedFolder.uri.fsPath, relPath));

    // Validate it's still within THAT workspace
    if (isPathWithinWorkspace(resolved, matchedFolder.uri.fsPath)) {
      return resolved;
    }
    // If it traversed out, block it
    console.warn(`[Security] Blocked path traversal attempt in multi-root: ${cleanPath}`);
    return matchedFolder.uri.fsPath;
  }

  // For standard relative paths, resolve against default workspace root
  const resolved = path.normalize(path.join(defaultWorkspaceRoot, cleanPath));

  // Check for path traversal (e.g., "../../../etc/passwd")
  // Since we resolved against defaultWorkspaceRoot, just check if it's within that one
  if (!isPathWithinWorkspace(resolved, defaultWorkspaceRoot)) {
    console.warn(`[Security] Blocked path traversal attempt: ${cleanPath}`);
    return defaultWorkspaceRoot;
  }

  return resolved;
}

export async function getCreatedDirectories(
  filePath: string,
  defaultWorkspaceRoot: string
): Promise<string[]> {
  const absolutePath = resolveAbsolutePath(filePath, defaultWorkspaceRoot);
  const dirPath = path.dirname(absolutePath);
  const createdDirs: string[] = [];

  // Determine the actual workspace root for this file to know when to stop
  const actualRoot = getWorkspaceRootForPath(absolutePath) || defaultWorkspaceRoot;

  let currentPath = dirPath;

  // Stop if we reach the workspace root or if path becomes shorter than root (outside)
  while (currentPath !== actualRoot && currentPath.length > actualRoot.length) {
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
