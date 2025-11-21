import * as vscode from 'vscode';
import * as path from 'path';

export function getWorkspaceRoot(): string | null {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return null;
  }
  return workspaceFolders[0].uri.fsPath;
}

export function resolveAbsolutePath(filePath: string, workspaceRoot: string): string {
  return path.isAbsolute(filePath) ? filePath : path.join(workspaceRoot, filePath);
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
