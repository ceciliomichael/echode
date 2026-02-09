import * as path from 'path';
import { ITool, ToolExecutionResult } from './tool.interface';
import { getAllWorkspaceFolders } from './utils/workspace-utils';
import { PathResolver } from '../path-resolver';
import { regexSearchFilesStructured } from '../ripgrep';
import { GrepFileResult } from '../ripgrep/types';
import { DEFAULT_IGNORED_PATTERNS, getExcludePatternsWithGitignore, gitignorePatternsToGlob } from '../../constants/excluded-patterns';

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
    const rawPath = parameters.path as string;
    const searchPath = rawPath?.trim() || '';
    const filePattern = parameters.includes as string | undefined;
    const isRegex = (parameters.isRegex as boolean) || false;
    const caseSensitive = (parameters.caseSensitive as boolean) || false;

    // Validate required parameters
    if (!query) {
      return { success: false, error: 'Search query is required' };
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

      // Execute searches
      const aggregatedResults: GrepFileResult[] = [];
      let totalMatches = 0;
      let filesWithMatches = 0;
      let aggregatedFormattedString = '';

      // Prepare user excludes
      const rawExcludes = parameters.excludes;
      const userExcludes = Array.isArray(rawExcludes) 
        ? rawExcludes.filter((x): x is string => typeof x === 'string')
        : (typeof rawExcludes === 'string' ? [rawExcludes] : []);

      for (const target of targets) {
        // Build comprehensive exclude patterns: defaults + gitignore + user-provided
        const gitignorePatterns = getExcludePatternsWithGitignore(target.root);
        const normalizedDefaults = gitignorePatternsToGlob(DEFAULT_IGNORED_PATTERNS);
        const normalizedUserExcludes = gitignorePatternsToGlob(userExcludes);

        const allExcludePatterns = [
          ...normalizedDefaults,
          ...gitignorePatterns,
          ...normalizedUserExcludes
        ];

        const result = await regexSearchFilesStructured(
          target.root,
          target.searchPath,
          query,
          globPattern,
          caseSensitive,
          allExcludePatterns
        );

        // If searching across multiple workspaces, prefix the file paths
        if (targets.length > 1 && target.workspaceName) {
          const prefixedResults = result.results.map(r => ({
            ...r,
            file: `${target.workspaceName}/${r.file}`
          }));
          aggregatedResults.push(...prefixedResults);
          
          if (result.formattedString && result.formattedString !== 'No results found') {
            aggregatedFormattedString += `\n--- Workspace: ${target.workspaceName} ---\n${result.formattedString}\n`;
          }
        } else {
          aggregatedResults.push(...result.results);
          if (result.formattedString && result.formattedString !== 'No results found') {
            aggregatedFormattedString += result.formattedString + '\n';
          }
        }

        totalMatches += result.totalMatches;
        filesWithMatches += result.filesWithMatches;
      }

      if (aggregatedFormattedString.trim() === '') {
        aggregatedFormattedString = 'No results found';
      }

      return {
        success: true,
        data: {
          query,
          path: searchPath || '/',
          filePattern: filePattern || '*',
          isRegex,
          caseSensitive,
          // Structured results for frontend UI rendering
          results: aggregatedResults,
          totalMatches: totalMatches,
          filesWithMatches: filesWithMatches,
          // Formatted string for AI context
          formattedResults: aggregatedFormattedString.trim(),
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
