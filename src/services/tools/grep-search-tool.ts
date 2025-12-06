import * as path from 'path';
import { ITool, ToolExecutionResult } from './tool.interface';
import { getWorkspaceRoot, resolveAbsolutePath } from './utils/workspace-utils';
import { regexSearchFilesStructured } from '../ripgrep';

/**
 * Grep Search Tool - Uses native ripgrep for fast regex searching
 * 
 * Ported from Roo Code's implementation for better performance.
 * Uses VSCode's bundled ripgrep binary instead of vscode.workspace.findFiles.
 */
export class GrepSearchTool implements ITool {
  name = 'grep_search';

  async execute(parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
    const query = parameters.query as string;
    const searchPath = (parameters.path as string) || '';
    const filePattern = parameters.includes as string | undefined;
    const isRegex = (parameters.isRegex as boolean) || false;
    const caseSensitive = (parameters.caseSensitive as boolean) || false;

    // Validate required parameters
    if (!query) {
      return { success: false, error: 'Search query is required' };
    }

    try {
      const workspaceRoot = getWorkspaceRoot();
      if (!workspaceRoot) {
        return { success: false, error: 'No workspace folder open' };
      }

      const absoluteSearchPath = searchPath
        ? resolveAbsolutePath(searchPath, workspaceRoot)
        : workspaceRoot;

      // Normalize file pattern for ripgrep glob syntax
      let globPattern: string | undefined;
      if (filePattern) {
        // Handle comma-separated patterns like "*.ts,*.tsx"
        const patterns = filePattern.split(',').map(p => p.trim());
        if (patterns.length === 1) {
          globPattern = patterns[0];
        } else {
          // Ripgrep uses {pattern1,pattern2} syntax for multiple patterns
          globPattern = `{${patterns.join(',')}}`;
        }
      }

      // Execute ripgrep search with structured results
      const searchResult = await regexSearchFilesStructured(
        workspaceRoot,
        absoluteSearchPath,
        query,
        globPattern
      );

      return {
        success: true,
        data: {
          query,
          path: searchPath || '/',
          filePattern: filePattern || '*',
          isRegex,
          caseSensitive,
          // Structured results for frontend UI rendering
          results: searchResult.results,
          totalMatches: searchResult.totalMatches,
          filesWithMatches: searchResult.filesWithMatches,
          // Formatted string for AI context
          formattedResults: searchResult.formattedString,
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
