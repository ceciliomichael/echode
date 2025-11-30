import * as vscode from 'vscode';
import * as path from 'path';
import { ITool, ToolExecutionResult } from './tool.interface';
import { getDefaultGrepExcludes } from '../../constants/excluded-patterns';
import { getWorkspaceRoot, resolveAbsolutePath } from './utils/workspace-utils';
import { scoreTextMatch } from '../search/text-matcher';
import { SearchIndexService } from '../search/search-index-service';

interface FileMatchResult {
  file: string;
  matches: Array<{
    line: number;
    column: number;
    text: string;
    matchText: string;
  }>;
  truncated?: boolean;
}

interface SkippedFile {
  file: string;
  reason: 'binary' | 'tooLarge' | 'regexError' | 'permissionDenied';
}

type GrepMatchMode = 'exact' | 'tokens' | 'fuzzyTokens' | 'semanticLite' | 'auto';

interface RankedMatch {
  line: number;
  column: number;
  text: string;
  matchText: string;
  score?: number;
}

export class GrepSearchTool implements ITool {
  name = 'grep_search';

  async execute(parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
    const query = parameters.query as string;
    const isRegex = (parameters.isRegex as boolean) ?? false;
    const searchPath = (parameters.path as string) || '';
    const includes = normalizeToStringArray(parameters.includes);
    const excludes = normalizeToStringArray(parameters.excludes, getDefaultGrepExcludes());
    
    // New enhanced parameters
    const smartCase = (parameters.smartCase as boolean) ?? true;
    const caseSensitive = parameters.caseSensitive !== undefined 
      ? (parameters.caseSensitive as boolean)
      : (smartCase && /[A-Z]/.test(query)); // Smart case: uppercase in query = case-sensitive
    
    const wholeWord = (parameters.wholeWord as boolean) ?? false;
    const multiline = (parameters.multiline as boolean) ?? false;
    const dotAll = (parameters.dotAll as boolean) ?? false;
    const rawMatchMode = parameters.matchMode as string | undefined;
    const matchMode = normalizeGrepMatchMode(rawMatchMode);
    const minTokenCoverageParam = parameters.minTokenCoverage;
    const minTokenCoverage = typeof minTokenCoverageParam === 'number' ? minTokenCoverageParam : 0.6;
    const fuzzyThresholdParam = parameters.fuzzyThreshold;
    const fuzzyThreshold = typeof fuzzyThresholdParam === 'number' ? fuzzyThresholdParam : 0.8;
    const rankResultsParam = parameters.rankResults;
    const rankResults = typeof rankResultsParam === 'boolean' ? rankResultsParam : true;
    
    // Limits
    const maxResults = (parameters.maxResults as number) || 1000;
    const maxFiles = (parameters.maxFiles as number) || 10000;
    const maxMatchesPerFile = (parameters.maxMatchesPerFile as number) || 1000;
    const maxFileSizeBytes = (parameters.maxFileSizeBytes as number) || 5 * 1024 * 1024; // 5MB default
    
    // Context
    const contextLines = (parameters.contextLines as number) || 0;
    const beforeContext = (parameters.beforeContext as number) ?? contextLines;
    const afterContext = (parameters.afterContext as number) ?? contextLines;

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

      // Prepare regex pattern with enhanced features
      let searchPattern: RegExp;
      let patternForSearch: string;

      try {
        if (isRegex) {
          patternForSearch = query;
          // Apply whole word wrapping if requested
          if (wholeWord) {
            patternForSearch = `\\b(?:${patternForSearch})\\b`;
          }
        } else {
          // Escape special regex characters for literal search
          patternForSearch = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          // Apply whole word wrapping if requested
          if (wholeWord) {
            patternForSearch = `\\b${patternForSearch}\\b`;
          }
        }

        // Build regex flags
        let flags = 'g'; // Global
        if (!caseSensitive) {
          flags += 'i';
        }
        if (multiline) {
          flags += 'm';
        }
        if (dotAll) {
          flags += 's';
        }
        flags += 'u'; // Unicode support

        searchPattern = new RegExp(patternForSearch, flags);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        return {
          success: false,
          error: `Invalid regex pattern: ${errorMsg}`,
        };
      }

      const effectiveMode: GrepMatchMode = isRegex ? 'exact' : matchMode === 'auto' ? 'semanticLite' : matchMode;
      const semanticOptions = {
        minTokenCoverage,
        fuzzyThreshold,
        allowFuzzy: effectiveMode === 'fuzzyTokens' || effectiveMode === 'semanticLite',
        requireAllTokens: effectiveMode === 'tokens',
        weightCoverage: 0.4,
        weightFuzzy: 0.3,
        weightOrder: 0.15,
        weightProximity: 0.15,
        exactBonus: 0.1,
        maxCandidateWords: 64,
      } as const;

      const includePattern = includes.length > 0 ? `{${includes.join(',')}}` : '**/*';
      const excludePattern = `{${excludes.join(',')}}`;

      const files = await vscode.workspace.findFiles(
        new vscode.RelativePattern(absoluteSearchPath, includePattern),
        excludePattern,
        maxFiles
      );

      const results: FileMatchResult[] = [];
      const skippedFiles: SkippedFile[] = [];
      const fileMatchCounts = new Map<string, number>();
      
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
          indexService.indexDocument(relativePath, content);

          // Check for binary content (contains null bytes)
          if (content.includes('\u0000')) {
            skippedFiles.push({
              file: path.relative(workspaceRoot, fileUri.fsPath),
              reason: 'binary',
            });
            continue;
          }

          const lines = content.split('\n');
          const fileMatches: RankedMatch[] = [];

          let fileMatchCount = 0;

          for (let i = 0; i < lines.length; i++) {
            if (totalMatches >= maxResults || fileMatchCount >= maxMatchesPerFile) {
              break;
            }

            const lineText = lines[i];

            if (effectiveMode === 'exact') {
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
            } else {
              const startLine = Math.max(0, i - beforeContext);
              const endLine = Math.min(lines.length - 1, i + afterContext);
              const contextText = beforeContext > 0 || afterContext > 0
                ? lines.slice(startLine, endLine + 1).join('\n')
                : lineText;

              const scored = scoreTextMatch(query, contextText, {
                minTokenCoverage: semanticOptions.minTokenCoverage,
                fuzzyThreshold: semanticOptions.fuzzyThreshold,
                allowFuzzy: semanticOptions.allowFuzzy,
                requireAllTokens: semanticOptions.requireAllTokens,
                weightCoverage: semanticOptions.weightCoverage,
                weightFuzzy: semanticOptions.weightFuzzy,
                weightOrder: semanticOptions.weightOrder,
                weightProximity: semanticOptions.weightProximity,
                exactBonus: semanticOptions.exactBonus,
                maxCandidateWords: semanticOptions.maxCandidateWords,
              });

              if (!scored) {
                continue;
              }

              fileMatches.push({
                line: i + 1,
                column: 0,
                text: contextText,
                matchText: query,
                score: scored.score,
              });

              fileMatchCount++;
              totalMatches++;
            }
          }

          if (fileMatches.length > 0) {
            if (effectiveMode !== 'exact' && rankResults) {
              fileMatches.sort((left, right) => {
                const leftScore = left.score ?? 0;
                const rightScore = right.score ?? 0;
                if (leftScore === rightScore) {
                  return 0;
                }
                return rightScore - leftScore;
              });
            }

            const exportedMatches = fileMatches.map((match) => ({
              line: match.line,
              column: match.column,
              text: match.text,
              matchText: match.matchText,
            }));
            results.push({
              file: relativePath,
              matches: exportedMatches,
              truncated: fileMatchCount >= maxMatchesPerFile,
            });
            fileMatchCounts.set(relativePath, fileMatchCount);
          }
        } catch (error) {
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
          multiline,
          smartCase,
          totalMatches,
          filesWithMatches: results.length,
          totalFilesSearched,
          totalFilesSkipped: skippedFiles.length,
          results,
          skippedFiles: skippedFiles.length > 0 ? skippedFiles : undefined,
          truncated: totalMatches >= maxResults || totalFilesSearched >= maxFiles,
          truncatedReason: totalMatches >= maxResults 
            ? 'maxResults' 
            : totalFilesSearched >= maxFiles 
              ? 'maxFiles' 
              : undefined,
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

function normalizeGrepMatchMode(value: unknown): GrepMatchMode {
  if (typeof value !== 'string') {
    return 'auto';
  }

  if (value === 'exact' || value === 'tokens' || value === 'fuzzyTokens' || value === 'semanticLite' || value === 'auto') {
    return value;
  }

  return 'auto';
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
