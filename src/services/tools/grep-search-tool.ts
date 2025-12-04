import * as vscode from 'vscode';
import * as path from 'path';
import { ITool, ToolExecutionResult } from './tool.interface';
import { getDefaultGrepExcludes, getExcludePatternsWithGitignore } from '../../constants/excluded-patterns';
import { getWorkspaceRoot, resolveAbsolutePath } from './utils/workspace-utils';
import { SearchIndexService } from '../search/search-index-service';

interface FileMatchResult {
  file: string;
  matches: Array<{
    line: number;
    column: number;
    text: string;
    matchText: string;
  }>;
}

interface SkippedFile {
  file: string;
  reason: 'binary' | 'tooLarge' | 'regexError' | 'permissionDenied';
}

export class GrepSearchTool implements ITool {
  name = 'grep_search';

  async execute(parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
    const query = parameters.query as string;
    const isRegex = (parameters.isRegex as boolean) ?? false;
    const searchPath = (parameters.path as string) || '';
    const includes = normalizeToStringArray(parameters.includes);
    // Get workspace root first for gitignore support
    const workspaceRootForExcludes = getWorkspaceRoot();
    const defaultExcludes = workspaceRootForExcludes 
      ? getExcludePatternsWithGitignore(workspaceRootForExcludes) 
      : getDefaultGrepExcludes();
    const excludes = normalizeToStringArray(parameters.excludes, defaultExcludes);
    
    // Smart case: case-sensitive only if query contains uppercase
    const smartCase = (parameters.smartCase as boolean) ?? true;
    const caseSensitive = parameters.caseSensitive !== undefined 
      ? (parameters.caseSensitive as boolean)
      : (smartCase && /[A-Z]/.test(query));
    
    const wholeWord = (parameters.wholeWord as boolean) ?? false;
    
    // Limits
    const maxResults = (parameters.maxResults as number) || 1000;
    const maxFiles = (parameters.maxFiles as number) || 10000;
    const maxMatchesPerFile = (parameters.maxMatchesPerFile as number) || 1000;
    const maxFileSizeBytes = (parameters.maxFileSizeBytes as number) || 5 * 1024 * 1024; // 5MB default
    
    // Context lines
    const contextLines = (parameters.contextLines as number) || 0;
    const beforeContext = (parameters.beforeContext as number) ?? contextLines;
    const afterContext = (parameters.afterContext as number) ?? contextLines;

    // Skip indexing for fast searches
    const skipIndexing = (parameters.skipIndexing as boolean) ?? false;

    if (!query) {
      return { success: false, error: 'Search query is required' };
    }

    try {
      const workspaceRoot = getWorkspaceRoot();
      if (!workspaceRoot) {
        return { success: false, error: 'No workspace folder open' };
      }

      const absoluteSearchPath = searchPath ? resolveAbsolutePath(searchPath, workspaceRoot) : workspaceRoot;
      const indexService = SearchIndexService.getInstance(workspaceRoot);

      // Build search pattern - always use exact matching
      let searchPattern: RegExp;
      let patternForSearch: string;

      try {
        if (isRegex) {
          patternForSearch = query;
          if (wholeWord) {
            patternForSearch = `\\b(?:${patternForSearch})\\b`;
          }
        } else {
          // Escape ALL regex special characters for literal/exact search
          // Hyphen must be at start of character class to be treated as literal
          patternForSearch = query.replace(/[-.*+?^${}()|[\]\\]/g, '\\$&');
          if (wholeWord) {
            patternForSearch = `\\b${patternForSearch}\\b`;
          }
        }

        // Build regex flags
        let flags = 'g';
        if (!caseSensitive) {
          flags += 'i';
        }
        flags += 'mu'; // Multiline + Unicode support

        searchPattern = new RegExp(patternForSearch, flags);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        return {
          success: false,
          error: `Invalid regex pattern: ${errorMsg}`,
        };
      }

      const includePattern = includes.length > 0 ? `{${includes.join(',')}}` : '**/*';
      const excludePattern = `{${excludes.join(',')}}`;

      const files = await vscode.workspace.findFiles(
        new vscode.RelativePattern(absoluteSearchPath, includePattern),
        excludePattern,
        maxFiles
      );

      const results: FileMatchResult[] = [];
      const skippedFiles: SkippedFile[] = [];
      let totalMatches = 0;
      let totalFilesSearched = 0;

      // Search through files
      for (const fileUri of files) {
        if (totalMatches >= maxResults) {
          break;
        }

        totalFilesSearched++;

        try {
          // Check file size before reading
          const fileStat = await vscode.workspace.fs.stat(fileUri);
          if (fileStat.size > maxFileSizeBytes) {
            skippedFiles.push({
              file: path.relative(workspaceRoot, fileUri.fsPath),
              reason: 'tooLarge',
            });
            continue;
          }

          const fileContent = await vscode.workspace.fs.readFile(fileUri);
          const content = Buffer.from(fileContent).toString('utf8');

          const relativePath = path.relative(workspaceRoot, fileUri.fsPath);
          if (!skipIndexing) {
            indexService.indexDocument(relativePath, content);
          }

          // Check for binary content (contains null bytes)
          if (content.includes('\u0000')) {
            skippedFiles.push({
              file: path.relative(workspaceRoot, fileUri.fsPath),
              reason: 'binary',
            });
            continue;
          }

          const lines = content.split('\n');
          const fileMatches: Array<{ line: number; column: number; text: string; matchText: string }> = [];
          let fileMatchCount = 0;

          for (let i = 0; i < lines.length; i++) {
            if (totalMatches >= maxResults || fileMatchCount >= maxMatchesPerFile) {
              break;
            }

            const lineText = lines[i];
            
            // Reset regex lastIndex for each line
            searchPattern.lastIndex = 0;
            const regexMatches = Array.from(lineText.matchAll(searchPattern));

            for (const match of regexMatches) {
              if (totalMatches >= maxResults || fileMatchCount >= maxMatchesPerFile) {
                break;
              }

              const startLine = Math.max(0, i - beforeContext);
              const endLine = Math.min(lines.length - 1, i + afterContext);
              const contextText = lines.slice(startLine, endLine + 1).join('\n');

              fileMatches.push({
                line: i + 1,
                column: match.index ?? 0,
                text: beforeContext > 0 || afterContext > 0 ? contextText : lineText,
                matchText: match[0],
              });

              fileMatchCount++;
              totalMatches++;
            }
          }

          if (fileMatches.length > 0) {
            results.push({
              file: relativePath,
              matches: fileMatches,
            });
          }
        } catch (_error) {
          // Skip files that can't be read
          const relativePath = path.relative(workspaceRoot, fileUri.fsPath);
          skippedFiles.push({
            file: relativePath,
            reason: 'permissionDenied',
          });
          continue;
        }
      }

      return {
        success: true,
        data: {
          query,
          isRegex,
          caseSensitive,
          wholeWord,
          smartCase,
          totalMatches,
          filesWithMatches: results.length,
          totalFilesSearched,
          totalFilesSkipped: skippedFiles.length,
          results,
          skippedFiles: skippedFiles.length > 0 ? skippedFiles : undefined,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to search: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
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
