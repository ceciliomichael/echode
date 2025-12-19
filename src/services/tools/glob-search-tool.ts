import * as path from 'path';
import * as fs from 'fs';
import { ITool, ToolExecutionResult } from './tool.interface';
import { getAllWorkspaceFolders } from './utils/workspace-utils';
import { PathResolver } from '../path-resolver';
import { listFilesWithRipgrep } from '../ripgrep';

interface FileResult {
  path: string;
  name: string;
  lines: number;
  type: 'file' | 'folder';
}

/**
 * Glob Search Tool - Uses native ripgrep for fast file discovery
 * 
 * Ported from Roo Code's implementation for better performance.
 * Uses VSCode's bundled ripgrep binary with --files flag.
 */
export class GlobSearchTool implements ITool {
  name = 'glob_search';

  async execute(parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
    const patterns = this.normalizePatterns(parameters.pattern);
    const searchPath = (parameters.path as string) || '';
    const excludes = normalizeToStringArray(parameters.excludes);
    const maxResults = (parameters.maxResults as number) || 1000;

    if (!patterns || patterns.length === 0) {
      return { success: false, error: 'At least one glob pattern is required' };
    }

    try {
      const folders = getAllWorkspaceFolders();
      if (folders.length === 0) {
        return { success: false, error: 'No workspace folder open' };
      }

      // Prepare search targets
      interface SearchTarget {
        root: string;
        searchPath: string;
        workspaceName?: string;
      }

      let targets: SearchTarget[] = [];

      if (searchPath) {
        // Specific path search
        let resolvedPath;
        try {
          resolvedPath = PathResolver.resolve(searchPath);
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Failed to resolve path' };
        }

        const { absolutePath, workspaceFolder } = resolvedPath;
        targets.push({
          root: workspaceFolder.uri.fsPath,
          searchPath: absolutePath
        });
      } else {
        // Search all workspaces if no path specified
        targets = folders.map(f => ({
          root: f.uri.fsPath,
          searchPath: f.uri.fsPath,
          workspaceName: f.name
        }));
      }

      // Execute searches
      const results: FileResult[] = [];
      let truncated = false;

      for (const target of targets) {
        // Check if we already hit the limit
        if (results.length >= maxResults) {
          truncated = true;
          break;
        }

        // Use ripgrep for fast file listing
        // Adjust limit based on what we already have
        const remainingLimit = maxResults - results.length;
        
        const fileResults = await listFilesWithRipgrep(target.searchPath, {
          limit: remainingLimit,
          globPatterns: patterns,
          excludePatterns: excludes,
        });

        const fileList = fileResults
          .filter(f => f.type === 'file');

        for (const f of fileList) {
          // If multi-root search, prefix the path with workspace name
          // f.path from listFilesWithRipgrep is relative to target.searchPath (root)
          let displayPath = f.path;
          if (targets.length > 1 && target.workspaceName) {
            displayPath = `${target.workspaceName}/${f.path}`;
          }

          const absolutePath = path.isAbsolute(f.path)
            ? f.path
            : path.join(target.root, f.path);
          
          let lineCount = 0;
          try {
            const content = fs.readFileSync(absolutePath, 'utf8');
            lineCount = content.split('\n').length;
          } catch {
            lineCount = 0;
          }

          results.push({
            path: displayPath,
            name: f.label || path.basename(f.path),
            lines: lineCount,
            type: f.type,
          });
        }
      }

      return {
        success: true,
        data: {
          patterns,
          searchPath: searchPath || '/',
          totalFiles: results.length,
          results,
          truncated: truncated || results.length >= maxResults,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to search files: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Normalize pattern parameter to array of strings
   */
  private normalizePatterns(pattern: unknown): string[] {
    if (!pattern) {
      return [];
    }

    if (typeof pattern === 'string') {
      return [pattern];
    }

    if (Array.isArray(pattern)) {
      return pattern.filter((p): p is string => typeof p === 'string');
    }

    return [];
  }
}

function normalizeToStringArray(value: unknown, defaultValue: string[] = []): string[] {
  if (!value) {
    return defaultValue;
  }

  if (typeof value === 'string') {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }

  return defaultValue;
}
