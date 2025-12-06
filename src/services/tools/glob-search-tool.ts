import * as path from 'path';
import * as fs from 'fs';
import { ITool, ToolExecutionResult } from './tool.interface';
import { getWorkspaceRoot, resolveAbsolutePath } from './utils/workspace-utils';
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
      const workspaceRoot = getWorkspaceRoot();
      if (!workspaceRoot) {
        return { success: false, error: 'No workspace folder open' };
      }

      const absoluteSearchPath = searchPath
        ? resolveAbsolutePath(searchPath, workspaceRoot)
        : workspaceRoot;

      // Use ripgrep for fast file listing
      const fileResults = await listFilesWithRipgrep(absoluteSearchPath, {
        limit: maxResults,
        globPatterns: patterns,
        excludePatterns: excludes,
      });

      // Filter to only files and format results with line count
      const results: FileResult[] = [];
      const fileList = fileResults
        .filter(f => f.type === 'file')
        .slice(0, maxResults);

      for (const f of fileList) {
        const absolutePath = path.isAbsolute(f.path)
          ? f.path
          : path.join(workspaceRoot, f.path);
        
        let lineCount = 0;
        try {
          const content = fs.readFileSync(absolutePath, 'utf8');
          lineCount = content.split('\n').length;
        } catch {
          // If we can't read the file, default to 0 lines
          lineCount = 0;
        }

        results.push({
          path: f.path,
          name: f.label || path.basename(f.path),
          lines: lineCount,
          type: f.type,
        });
      }

      return {
        success: true,
        data: {
          patterns,
          searchPath: searchPath || '/',
          totalFiles: results.length,
          results,
          truncated: results.length >= maxResults,
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
