import * as vscode from 'vscode';
import * as path from 'path';
import { ITool, ToolExecutionResult } from './tool.interface';
import { getDefaultGrepExcludes } from '../../constants/excluded-patterns';
import { getWorkspaceRoot, resolveAbsolutePath } from './utils/workspace-utils';

interface FileResult {
  path: string;
  name: string;
  size: number;
  type: 'file';
  extension: string;
}

interface SkippedFile {
  file: string;
  reason: 'permissionDenied' | 'tooLarge' | 'invalidType';
}

export class GlobSearchTool implements ITool {
  name = 'glob_search';

  async execute(parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
    const patterns = this.normalizePatterns(parameters.pattern);
    const searchPath = (parameters.path as string) || '';
    const excludes = (parameters.excludes as string[]) || getDefaultGrepExcludes();
    const maxResults = (parameters.maxResults as number) || 1000;
    const maxFileSizeBytes = (parameters.maxFileSizeBytes as number) || 100 * 1024 * 1024; // 100MB default
    const sortBy = (parameters.sortBy as 'name' | 'size' | 'extension') || 'name';
    const sortOrder = (parameters.sortOrder as 'asc' | 'desc') || 'asc';

    if (!patterns || patterns.length === 0) {
      return { success: false, error: 'At least one glob pattern is required' };
    }

    try {
      const workspaceRoot = getWorkspaceRoot();
      if (!workspaceRoot) {
        return { success: false, error: 'No workspace folder open' };
      }

      const absoluteSearchPath = searchPath ? resolveAbsolutePath(searchPath, workspaceRoot) : workspaceRoot;

      // Validate search path exists
      try {
        const searchUri = vscode.Uri.file(absoluteSearchPath);
        await vscode.workspace.fs.stat(searchUri);
      } catch (error) {
        return {
          success: false,
          error: `Search path does not exist: ${searchPath || 'workspace root'}`,
        };
      }

      const results: FileResult[] = [];
      const skippedFiles: SkippedFile[] = [];
      const seenPaths = new Set<string>(); // Track duplicates from multiple patterns

      // Process each pattern
      for (const pattern of patterns) {
        if (results.length >= maxResults) {
          break;
        }

        // Build include and exclude patterns
        const includePattern = pattern;
        const excludePattern = `{${excludes.join(',')}}`;

        try {
          // Find files matching the pattern
          const files = await vscode.workspace.findFiles(
            new vscode.RelativePattern(absoluteSearchPath, includePattern),
            excludePattern,
            maxResults - results.length
          );

          // Process each file
          for (const fileUri of files) {
            if (results.length >= maxResults) {
              break;
            }

            const relativePath = path.relative(workspaceRoot, fileUri.fsPath);

            // Skip duplicates from overlapping patterns
            if (seenPaths.has(relativePath)) {
              continue;
            }
            seenPaths.add(relativePath);

            try {
              // Get file stats
              const fileStat = await vscode.workspace.fs.stat(fileUri);

              // Skip directories (only include files)
              if (fileStat.type === vscode.FileType.Directory) {
                continue;
              }

              // Check file size limit
              if (fileStat.size > maxFileSizeBytes) {
                skippedFiles.push({
                  file: relativePath,
                  reason: 'tooLarge',
                });
                continue;
              }

              // Extract file metadata
              const fileName = path.basename(fileUri.fsPath);
              const extension = path.extname(fileUri.fsPath).slice(1) || ''; // Remove leading dot

              results.push({
                path: relativePath,
                name: fileName,
                size: fileStat.size,
                type: 'file',
                extension,
              });
            } catch (error) {
              // Permission denied or other file access errors
              skippedFiles.push({
                file: relativePath,
                reason: 'permissionDenied',
              });
              continue;
            }
          }
        } catch (error) {
          // Pattern-specific error (e.g., invalid glob syntax)
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          return {
            success: false,
            error: `Failed to process pattern "${pattern}": ${errorMsg}`,
          };
        }
      }

      // Sort results
      this.sortResults(results, sortBy, sortOrder);

      return {
        success: true,
        data: {
          patterns,
          searchPath: searchPath || '/',
          totalFiles: results.length,
          totalSkipped: skippedFiles.length,
          results,
          skippedFiles: skippedFiles.length > 0 ? skippedFiles : undefined,
          truncated: results.length >= maxResults,
          sortBy,
          sortOrder,
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

  /**
   * Sort file results based on criteria
   */
  private sortResults(
    results: FileResult[],
    sortBy: 'name' | 'size' | 'extension',
    sortOrder: 'asc' | 'desc'
  ): void {
    const multiplier = sortOrder === 'asc' ? 1 : -1;

    results.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'extension':
          comparison = a.extension.localeCompare(b.extension);
          if (comparison === 0) {
            // Secondary sort by name if extensions are the same
            comparison = a.name.localeCompare(b.name);
          }
          break;
      }

      return comparison * multiplier;
    });
  }
}
