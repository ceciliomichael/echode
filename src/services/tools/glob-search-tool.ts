import * as vscode from 'vscode';
import * as path from 'path';
import { ITool, ToolExecutionResult } from './tool.interface';
import { getDefaultGrepExcludes } from '../../constants/excluded-patterns';
import { getWorkspaceRoot, resolveAbsolutePath } from './utils/workspace-utils';
import { scoreTextMatch } from '../search/text-matcher';
import { SearchIndexService } from '../search/search-index-service';

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

type GlobMatchMode = 'glob' | 'fuzzyPath' | 'auto';

export class GlobSearchTool implements ITool {
  name = 'glob_search';

  async execute(parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
    const patterns = this.normalizePatterns(parameters.pattern);
    const searchPath = (parameters.path as string) || '';
    const excludes = (parameters.excludes as string[]) || getDefaultGrepExcludes();
    const maxResults = (parameters.maxResults as number) || 1000;
    const maxFileSizeBytes = (parameters.maxFileSizeBytes as number) || 100 * 1024 * 1024;
    const sortByParam = parameters.sortBy as 'name' | 'size' | 'extension' | 'relevance' | undefined;
    const sortBy = sortByParam ?? 'name';
    const rawMatchMode = parameters.matchMode as string | undefined;
    const matchMode = normalizeGlobMatchMode(rawMatchMode);
    const preferFilenameParam = parameters.preferFilename;
    const preferFilename = typeof preferFilenameParam === 'boolean' ? preferFilenameParam : true;
    const minPathScoreParam = parameters.minPathScore;
    const minPathScore = typeof minPathScoreParam === 'number' ? minPathScoreParam : 0.4;
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
      const indexService = SearchIndexService.getInstance(workspaceRoot);

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
      const seenPaths = new Set<string>();

      const hasGlobPattern = patterns.some((pattern) => hasGlobSyntax(pattern));
      const effectiveMode: GlobMatchMode = matchMode === 'glob'
        ? 'glob'
        : matchMode === 'fuzzyPath'
          ? 'fuzzyPath'
          : hasGlobPattern
            ? 'glob'
            : 'fuzzyPath';

      if (effectiveMode === 'glob') {
        for (const pattern of patterns) {
          if (results.length >= maxResults) {
            break;
          }

          const includePattern = pattern;
          const excludePattern = `{${excludes.join(',')}}`;

          try {
            const files = await vscode.workspace.findFiles(
              new vscode.RelativePattern(absoluteSearchPath, includePattern),
              excludePattern,
              maxResults - results.length
            );

            for (const fileUri of files) {
              if (results.length >= maxResults) {
                break;
              }

              const relativePath = path.relative(workspaceRoot, fileUri.fsPath);

              if (seenPaths.has(relativePath)) {
                continue;
              }
              seenPaths.add(relativePath);

              try {
                const fileStat = await vscode.workspace.fs.stat(fileUri);

                if (fileStat.type === vscode.FileType.Directory) {
                  continue;
                }

                if (fileStat.size > maxFileSizeBytes) {
                  skippedFiles.push({
                    file: relativePath,
                    reason: 'tooLarge',
                  });
                  continue;
                }

                const fileName = path.basename(fileUri.fsPath);
                const extension = path.extname(fileUri.fsPath).slice(1) || '';

                indexService.indexPathOnly(relativePath);

                results.push({
                  path: relativePath,
                  name: fileName,
                  size: fileStat.size,
                  type: 'file',
                  extension,
                });
              } catch (_error) {
                skippedFiles.push({
                  file: relativePath,
                  reason: 'permissionDenied',
                });
                continue;
              }
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            return {
              success: false,
              error: `Failed to process pattern "${pattern}": ${errorMsg}`,
            };
          }
        }
      } else {
        const combinedQuery = patterns.join(' ');
        const excludePattern = `{${excludes.join(',')}}`;

        const files = await vscode.workspace.findFiles(
          new vscode.RelativePattern(absoluteSearchPath, '**/*'),
          excludePattern,
          maxResults
        );

        for (const fileUri of files) {
          const relativePath = path.relative(workspaceRoot, fileUri.fsPath);

          if (seenPaths.has(relativePath)) {
            continue;
          }
          seenPaths.add(relativePath);

          try {
            const fileStat = await vscode.workspace.fs.stat(fileUri);

            if (fileStat.type === vscode.FileType.Directory) {
              continue;
            }

            if (fileStat.size > maxFileSizeBytes) {
              skippedFiles.push({
                file: relativePath,
                reason: 'tooLarge',
              });
              continue;
            }

            const fileName = path.basename(fileUri.fsPath);
            const extension = path.extname(fileUri.fsPath).slice(1) || '';
            const candidatePath = relativePath.replace(/\\/g, '/');

            const filenameText = fileName;
            const pathText = candidatePath;

            const nameScoreResult = scoreTextMatch(combinedQuery, filenameText, {
              minTokenCoverage: 0.5,
              fuzzyThreshold: 0.8,
              allowFuzzy: true,
              requireAllTokens: false,
              weightCoverage: 0.45,
              weightFuzzy: 0.35,
              weightOrder: 0.1,
              weightProximity: 0.1,
              exactBonus: 0.1,
              maxCandidateWords: 32,
            });

            const pathScoreResult = scoreTextMatch(combinedQuery, pathText, {
              minTokenCoverage: 0.5,
              fuzzyThreshold: 0.8,
              allowFuzzy: true,
              requireAllTokens: false,
              weightCoverage: 0.5,
              weightFuzzy: 0.3,
              weightOrder: 0.1,
              weightProximity: 0.1,
              exactBonus: 0.05,
              maxCandidateWords: 64,
            });

            const nameScore = nameScoreResult?.score ?? 0;
            const pathScore = pathScoreResult?.score ?? 0;

            const filenameWeight = preferFilename ? 0.6 : 0.4;
            const pathWeight = preferFilename ? 0.4 : 0.6;
            const combinedScore = nameScore * filenameWeight + pathScore * pathWeight;

            if (combinedScore < minPathScore) {
              continue;
            }

            indexService.indexPathOnly(relativePath);

            results.push({
              path: relativePath,
              name: fileName,
              size: fileStat.size,
              type: 'file',
              extension,
            });
          } catch (_error) {
            skippedFiles.push({
              file: relativePath,
              reason: 'permissionDenied',
            });
            continue;
          }
        }
      }

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
    sortBy: 'name' | 'size' | 'extension' | 'relevance',
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
        case 'relevance':
          comparison = 0;
          break;
      }

      return comparison * multiplier;
    });
  }
}

function normalizeGlobMatchMode(value: unknown): GlobMatchMode {
  if (typeof value !== 'string') {
    return 'auto';
  }

  if (value === 'glob' || value === 'fuzzyPath' || value === 'auto') {
    return value;
  }

  return 'auto';
}

function hasGlobSyntax(pattern: string): boolean {
  return /[\*\?\[\]\{\}]/.test(pattern);
}
