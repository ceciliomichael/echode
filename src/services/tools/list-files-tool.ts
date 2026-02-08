import * as vscode from 'vscode';
import * as path from 'path';
import { ITool, ToolExecutionResult } from './tool.interface';
import { resolveAbsolutePath, getAllWorkspaceFolders } from './utils/workspace-utils';
import { PathResolver } from '../path-resolver';
import { parseGitignore, matchesGitignorePattern } from '../../constants/excluded-patterns';

const MAX_LIST_FILES_RESULTS = 200;

interface GitignoreContext {
  basePath: string; // Relative path from workspace root
  patterns: string[];
}

// Cache for gitignore contexts
const gitignoreCache = new Map<string, string[]>();

function getGitignorePatterns(dirPath: string): string[] {
  if (!gitignoreCache.has(dirPath)) {
    gitignoreCache.set(dirPath, parseGitignore(dirPath));
  }
  return gitignoreCache.get(dirPath) || [];
}

/**
 * Clear the gitignore cache (useful when .gitignore changes)
 */
export function clearListFilesGitignoreCache(): void {
  gitignoreCache.clear();
}

function shouldExcludeFileFromListing(
  name: string,
  workspacePath: string,
  relativePath: string,
  contexts: GitignoreContext[],
  ignoreGitignore?: boolean
): boolean {
  if (name.toLowerCase() === 'agents.md'.toLowerCase()) {
    return true;
  }

  // Skip exclusion check if requested (allows listing ignored directories)
  if (ignoreGitignore) {
    return false;
  }

  // Check against all active gitignore contexts
  for (const context of contexts) {
    // Calculate path relative to this gitignore context
    // If context base is '', path is relativePath
    // If context base is 'src', and relativePath is 'src/file', rel is 'file'
    let relToContext: string;

    if (context.basePath === '') {
      relToContext = relativePath || name;
    } else {
      // Only apply if file is inside this context's base
      // e.g. base='src', file='src/foo' -> 'foo'
      // file='dist/bar' -> not inside, skip

      // Normalize separators
      const relPathNorm = (relativePath || name).replace(/\\/g, '/');
      const baseNorm = context.basePath.replace(/\\/g, '/');

      if (relPathNorm === baseNorm || relPathNorm.startsWith(baseNorm + '/')) {
        relToContext = relPathNorm.slice(baseNorm.length + 1); // +1 for slash
      } else {
        continue; // File not in this context
      }
    }

    if (matchesGitignorePattern(relToContext, context.patterns)) {
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
  ignoreGitignore: boolean | undefined,
  contexts: GitignoreContext[]
): Promise<void> {
  if (truncatedRef.value) {
    return;
  }

  // Check for .gitignore in this directory and add to contexts
  let localContexts = contexts;
  const absolutePath = currentRelPath
    ? resolveAbsolutePath(currentRelPath, workspaceRoot)
    : workspaceRoot;

  const gitignorePath = path.join(absolutePath, '.gitignore');
  let hasGitignore = false;
  try {
    // Check if .gitignore exists (without simple fs.exists which is deprecated)
    // Actually getGitignorePatterns handles parsing internally, but parseGitignore uses fs.existsSync?
    // We can just rely on getGitignorePatterns returning [] if file empty or missing?
    // But we want to avoid disk read if possible? 
    // Safe to just call getGitignorePatterns for current directory
    const patterns = getGitignorePatterns(absolutePath);
    if (patterns.length > 0) {
      localContexts = [...contexts, { basePath: currentRelPath || '', patterns }];
    }
  } catch (e) { }

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

    const childRelPath = currentRelPath
      ? `${currentRelPath}/${name}`
      : name;

    if (fileType === vscode.FileType.Directory) {
      // Check if directory should be excluded
      if (shouldExcludeFileFromListing(name, workspaceRoot, childRelPath, localContexts, ignoreGitignore)) {
        continue;
      }
      await collectFilesRecursively(workspaceRoot, baseDirPath, childRelPath, files, truncatedRef, ignoreGitignore, localContexts);
    } else if (fileType === vscode.FileType.File) {
      if (files.length >= MAX_LIST_FILES_RESULTS) {
        truncatedRef.value = true;
        break;
      }

      if (shouldExcludeFileFromListing(name, workspaceRoot, childRelPath, localContexts, ignoreGitignore)) {
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
    const rawPath = parameters.path as string;
    const dirPath = rawPath?.trim() || '';
    const rawRecursive = parameters.recursive;
    const recursive = rawRecursive === true || rawRecursive === 'true';
    const rawIgnoreGitignore = parameters.ignoreGitignore;
    let ignoreGitignore = rawIgnoreGitignore === true || rawIgnoreGitignore === 'true';

    // 0. Handle Multi-Root Virtual Listing (Empty Path + Multiple Roots)
    const allFolders = getAllWorkspaceFolders();
    if (!dirPath && allFolders.length > 1) {
      // Return virtual root listing
      const directories = allFolders.map(f => ({ name: f.name, type: 'directory' }));
      // Sort alphabetically
      directories.sort((a, b) => a.name.localeCompare(b.name));
      
      return {
        success: true,
        data: {
          path: '/',
          directories,
          files: [],
          totalCount: directories.length,
          truncated: false
        }
      };
    }

    // 1. Resolve Path and Workspace
    let resolvedPath;
    try {
      // If path is empty string, PathResolver resolves to primary workspace root
      // which is what we want for single-root or fallback behavior
      resolvedPath = PathResolver.resolve(dirPath);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to resolve path' };
    }

    const { absolutePath, workspaceFolder } = resolvedPath;
    const workspaceRoot = workspaceFolder.uri.fsPath;

    // Auto-bypass: If user explicitly provides a path that is ignored by .gitignore,
    // assume they want to see it (they mentioned it explicitly)
    if (!ignoreGitignore && dirPath) {
      try {
        const rootPatterns = getGitignorePatterns(workspaceRoot);
        // Note: matchesGitignorePattern typically expects relative path
        // We need the path relative to the workspace root
        const relToCheck = path.relative(workspaceRoot, absolutePath);
        if (matchesGitignorePattern(relToCheck, rootPatterns)) {
          // Target path is ignored, user must be explicitly asking for it
          ignoreGitignore = true;
        }
      } catch { }
    }

    try {
      const uri = vscode.Uri.file(absolutePath);
      const entries = await vscode.workspace.fs.readDirectory(uri);

      const files: Array<{ name: string; type: string; size?: number }> = [];
      const directories: Array<{ name: string; type: string }> = [];
      const truncatedRef = { value: false };


      // Initial contexts: scan up from dirPath
      const contexts: GitignoreContext[] = [];

      // 1. Root context
      contexts.push({ basePath: '', patterns: getGitignorePatterns(workspaceRoot) });

      // 2. Scan intermediate directories if dirPath is set
      // e.g. path='src/tools'. Check 'src/.gitignore' and 'src/tools/.gitignore'
      // BUT `getGitignorePatterns` expects Absolute FS Path.

      if (dirPath) {
        const parts = dirPath.split('/');
        let currentBuild = '';
        for (const part of parts) {
          currentBuild = currentBuild ? `${currentBuild}/${part}` : part;
          const abs = resolveAbsolutePath(currentBuild, workspaceRoot);
          const patterns = getGitignorePatterns(abs);
          if (patterns.length > 0) {
            contexts.push({ basePath: currentBuild, patterns });
          }
        }
      }

      for (const [name, fileType] of entries) {
        // Skip hidden files/folders (except .gitignore)
        if (name.startsWith('.') && name !== '.gitignore') {
          continue;
        }

        const relPath = dirPath ? `${dirPath}/${name}` : name;

        if (shouldExcludeFileFromListing(name, workspaceRoot, relPath, contexts, ignoreGitignore)) {
          continue;
        }

        if (fileType === vscode.FileType.Directory) {
          directories.push({ name, type: 'directory' });

          if (recursive) {
            await collectFilesRecursively(workspaceRoot, dirPath, relPath, files, truncatedRef, ignoreGitignore, contexts);
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
