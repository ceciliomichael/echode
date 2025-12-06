import * as vscode from 'vscode';
import { ITool, ToolExecutionResult } from './tool.interface';
import { getWorkspaceRoot, resolveAbsolutePath } from './utils/workspace-utils';
import { parseGitignore, matchesGitignorePattern } from '../../constants/excluded-patterns';

const MAX_LIST_FILES_RESULTS = 200;

// Cache for gitignore patterns
const gitignoreCache = new Map<string, string[]>();

function getGitignorePatterns(workspacePath: string): string[] {
  if (!gitignoreCache.has(workspacePath)) {
    gitignoreCache.set(workspacePath, parseGitignore(workspacePath));
  }
  return gitignoreCache.get(workspacePath) || [];
}

/**
 * Clear the gitignore cache (useful when .gitignore changes)
 */
export function clearListFilesGitignoreCache(): void {
  gitignoreCache.clear();
}

function shouldExcludeFileFromListing(name: string, workspacePath?: string, relativePath?: string): boolean {
  if (name.toLowerCase() === 'agents.md'.toLowerCase()) {
    return true;
  }

  // Check gitignore patterns
  if (workspacePath) {
    const gitignorePatterns = getGitignorePatterns(workspacePath);
    const pathToCheck = relativePath || name;
    if (matchesGitignorePattern(pathToCheck, gitignorePatterns)) {
      return true;
    }
  }

  return false;
}

async function collectFilesRecursively(
  workspaceRoot: string,
  baseDirPath: string,
  currentRelPath: string,
  files: Array<{ name: string; type: string; size?: number }>,
  truncatedRef: { value: boolean },
): Promise<void> {
  if (truncatedRef.value) {
    return;
  }

  const effectiveRelPath = currentRelPath || baseDirPath;
  const absolutePath = effectiveRelPath
    ? resolveAbsolutePath(effectiveRelPath, workspaceRoot)
    : workspaceRoot;
  const uri = vscode.Uri.file(absolutePath);

  const entries = await vscode.workspace.fs.readDirectory(uri);

  for (const [name, fileType] of entries) {
    if (truncatedRef.value) {
      break;
    }

    // Skip hidden files/folders (except .gitignore)
    if (name.startsWith('.') && name !== '.gitignore') {
      continue;
    }

    const childRelPath = effectiveRelPath
      ? `${effectiveRelPath}/${name}`
      : name;

    if (fileType === vscode.FileType.Directory) {
      // Check if directory should be excluded
      if (shouldExcludeFileFromListing(name, workspaceRoot, childRelPath)) {
        continue;
      }
      await collectFilesRecursively(workspaceRoot, baseDirPath, childRelPath, files, truncatedRef);
    } else if (fileType === vscode.FileType.File) {
      if (files.length >= MAX_LIST_FILES_RESULTS) {
        truncatedRef.value = true;
        break;
      }

      if (shouldExcludeFileFromListing(name, workspaceRoot, childRelPath)) {
        continue;
      }

      let size: number | undefined;
      try {
        const fileStat = await vscode.workspace.fs.stat(
          vscode.Uri.file(resolveAbsolutePath(childRelPath, workspaceRoot)),
        );
        size = fileStat.size;
      } catch {
        size = undefined;
      }

      files.push({ name: childRelPath, type: 'file', size });
    }
  }
}

export class ListFilesTool implements ITool {
  name = 'list_files';

  async execute(parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
    const dirPath = (parameters.path as string) || '';
    const rawRecursive = parameters.recursive;
    const recursive = rawRecursive === true || rawRecursive === 'true';

    try {
      const workspaceRoot = getWorkspaceRoot();
      if (!workspaceRoot) {
        return { success: false, error: 'No workspace folder open' };
      }

      const absolutePath = dirPath ? resolveAbsolutePath(dirPath, workspaceRoot) : workspaceRoot;
      const uri = vscode.Uri.file(absolutePath);
      const entries = await vscode.workspace.fs.readDirectory(uri);

      const files: Array<{ name: string; type: string; size?: number }> = [];
      const directories: Array<{ name: string; type: string }> = [];
      const truncatedRef = { value: false };

      for (const [name, fileType] of entries) {
        // Skip hidden files/folders (except .gitignore)
        if (name.startsWith('.') && name !== '.gitignore') {
          continue;
        }

        const relPath = dirPath ? `${dirPath}/${name}` : name;

        if (shouldExcludeFileFromListing(name, workspaceRoot, relPath)) {
          continue;
        }

        if (fileType === vscode.FileType.Directory) {
          directories.push({ name, type: 'directory' });

          if (recursive) {
            await collectFilesRecursively(workspaceRoot, dirPath, relPath, files, truncatedRef);
          }
        } else if (fileType === vscode.FileType.File) {
          if (files.length >= MAX_LIST_FILES_RESULTS) {
            truncatedRef.value = true;
            break;
          }

          let size: number | undefined;
          try {
            const fileStat = await vscode.workspace.fs.stat(uri.with({ path: `${uri.path}/${name}` }));
            size = fileStat.size;
          } catch {
            size = undefined;
          }

          files.push({ name: relPath, type: 'file', size });
        }
      }

      // Sort alphabetically
      files.sort((a, b) => a.name.localeCompare(b.name));
      directories.sort((a, b) => a.name.localeCompare(b.name));

      return {
        success: true,
        data: {
          path: dirPath || '/',
          directories,
          files,
          totalCount: files.length + directories.length,
          truncated: truncatedRef.value,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
