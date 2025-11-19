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
