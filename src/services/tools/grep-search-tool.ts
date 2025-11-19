import * as vscode from 'vscode';
import * as path from 'path';
import { ITool, ToolExecutionResult } from './tool.interface';
import { getDefaultGrepExcludes } from '../../constants/excluded-patterns';
import { getWorkspaceRoot, resolveAbsolutePath } from './utils/workspace-utils';

export class GrepSearchTool implements ITool {
  name = 'grep_search';

  async execute(parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
    const query = parameters.query as string;
    const isRegex = (parameters.isRegex as boolean) ?? false;
    const caseSensitive = (parameters.caseSensitive as boolean) ?? false;
    const searchPath = (parameters.path as string) || '';
    const includes = (parameters.includes as string[]) || [];
    const excludes = (parameters.excludes as string[]) || getDefaultGrepExcludes();
    const maxResults = (parameters.maxResults as number) || 100;
    const contextLines = (parameters.contextLines as number) || 0;

    if (!query) {
      return { success: false, error: 'Search query is required' };
    }

    try {
      const workspaceRoot = getWorkspaceRoot();
      if (!workspaceRoot) {
        return { success: false, error: 'No workspace folder open' };
      }

      const absoluteSearchPath = searchPath ? resolveAbsolutePath(searchPath, workspaceRoot) : workspaceRoot;

      // Build glob pattern for file discovery
      const includePattern = includes.length > 0 
        ? `{${includes.join(',')}}` 
        : '**/*';
      
      const excludePattern = `{${excludes.join(',')}}`;

      // Find files
      const files = await vscode.workspace.findFiles(
        new vscode.RelativePattern(absoluteSearchPath, includePattern),
        excludePattern
      );

      // Prepare search pattern
      let searchPattern: RegExp;
      try {
        if (isRegex) {
          searchPattern = new RegExp(query, caseSensitive ? 'g' : 'gi');
        } else {
          const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          searchPattern = new RegExp(escapedQuery, caseSensitive ? 'g' : 'gi');
        }
      } catch (error) {
        return {
          success: false,
          error: `Invalid regex pattern: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }

      const results: Array<{
        file: string;
        matches: Array<{
          line: number;
          column: number;
          text: string;
          matchText: string;
        }>;
      }> = [];

      let totalMatches = 0;

      // Search through files
      for (const fileUri of files) {
        if (totalMatches >= maxResults) {
          break;
        }

        try {
          const fileContent = await vscode.workspace.fs.readFile(fileUri);
          const content = Buffer.from(fileContent).toString('utf8');
          const lines = content.split('\n');

          const fileMatches: Array<{
            line: number;
            column: number;
            text: string;
            matchText: string;
          }> = [];

          for (let i = 0; i < lines.length; i++) {
            if (totalMatches >= maxResults) {
              break;
            }

            const lineText = lines[i];
            const matches = Array.from(lineText.matchAll(searchPattern));

            if (matches.length > 0) {
              for (const match of matches) {
                if (totalMatches >= maxResults) {
                  break;
                }

                // Get context lines
                const startLine = Math.max(0, i - contextLines);
                const endLine = Math.min(lines.length - 1, i + contextLines);
                const contextText = lines.slice(startLine, endLine + 1).join('\n');

                fileMatches.push({
                  line: i + 1,
                  column: match.index ?? 0,
                  text: contextLines > 0 ? contextText : lineText,
                  matchText: match[0],
                });

                totalMatches++;
              }
            }
          }

          if (fileMatches.length > 0) {
            const relativePath = path.relative(workspaceRoot, fileUri.fsPath);
            results.push({
              file: relativePath,
              matches: fileMatches,
            });
          }
        } catch (error) {
          // Skip files that can't be read
          continue;
        }
      }

      return {
        success: true,
        data: {
          query,
          isRegex,
          caseSensitive,
          totalMatches,
          filesWithMatches: results.length,
          results,
          truncated: totalMatches >= maxResults,
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
