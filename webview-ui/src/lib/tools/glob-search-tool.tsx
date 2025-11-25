import { FileSearch } from 'lucide-react';
import type { ToolExecutionResult } from '../../types/tool';
import { registerToolPlugin } from './tool-plugin';
import { executeToolViaExtension } from '../tool-utils';
import { getFileIconConfig } from '../../utils/file-icon-mapper';

/**
 * Glob Search Tool
 */
async function executeGlobSearch(
  parameters: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<ToolExecutionResult> {
  return executeToolViaExtension('glob_search', parameters, signal);
}

// Register glob_search tool
registerToolPlugin({
  metadata: {
    id: 'glob_search',
    name: 'Glob Search',
    description: 'Find files based on glob patterns',
    aiDescription: `## glob_search
Description: Find files and directories matching glob patterns. Use this tool to discover files by name, extension, or path patterns across your workspace. Ideal for finding files when you know the filename pattern or structure but not the exact location.

Parameters:
- pattern: (required) Glob pattern(s) to search for (e.g., *.ts, **/*.json, components/**/Button.tsx)
- path: (optional) Directory to search in (default: workspace root)
- excludes: (optional) Glob patterns to exclude (e.g., node_modules/**)
- sortBy: (optional) Sort results by 'name', 'size', or 'extension' (default: name)
- sortOrder: (optional) Sort order 'asc' or 'desc' (default: asc)

Usage:
<function_calls>
<invoke name="glob_search">
<parameter name="pattern">glob pattern</parameter>
<parameter name="path">search directory</parameter>
</invoke>
</function_calls>

Examples:

1. Find all TypeScript files:
<function_calls>
<invoke name="glob_search">
<parameter name="pattern">**/*.ts</parameter>
</invoke>
</function_calls>

2. Find all component files in src:
<function_calls>
<invoke name="glob_search">
<parameter name="pattern">**/*Component.tsx</parameter>
<parameter name="path">src</parameter>
</invoke>
</function_calls>

3. Find config files with specific extension:
<function_calls>
<invoke name="glob_search">
<parameter name="pattern">*.config.{js,ts,json}</parameter>
</invoke>
</function_calls>

IMPORTANT: Pattern Guidelines:
- Use * to match any characters in a single directory level
- Use ** to match any characters across multiple directory levels
- Use {a,b,c} to match multiple alternatives
- After finding files with glob_search, use read_file to examine specific files
- For content search (finding code/text), use grep_search instead`,
    icon: FileSearch,
    usage: 'Find files based on glob patterns',
    formatExample: '<function_calls>\n<invoke name="glob_search">\n<parameter name="pattern">*.ts</parameter>\n<parameter name="path">src</parameter>\n</invoke>\n</function_calls>',
  },
  handler: {
    execute: executeGlobSearch,
  },
  renderer: (data: unknown) => {
    if (typeof data === 'object' && data !== null) {
      const result = data as {
        patterns: string[];
        searchPath: string;
        totalFiles: number;
        totalSkipped: number;
        results: Array<{
          path: string;
          name: string;
          size: number;
          type: 'file';
          extension: string;
        }>;
        skippedFiles?: Array<{
          file: string;
          reason: 'permissionDenied' | 'tooLarge' | 'invalidType';
        }>;
        truncated: boolean;
        sortBy: 'name' | 'size' | 'extension';
        sortOrder: 'asc' | 'desc';
      };

      const isEmpty = result.results.length === 0;
      const hasSkipped = result.skippedFiles && result.skippedFiles.length > 0;

      // Format file size
      const formatSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      };

      // Group files by extension if sorted by extension
      const groupedResults: Record<string, typeof result.results> = {};
      if (result.sortBy === 'extension') {
        result.results.forEach((file) => {
          const ext = file.extension || 'no extension';
          if (!groupedResults[ext]) {
            groupedResults[ext] = [];
          }
          groupedResults[ext].push(file);
        });
      }

      return (
        <div className="rounded-md overflow-hidden border border-[var(--vscode-input-border)] bg-[var(--vscode-editor-background)]">
          {/* Header */}
          <div
            className="px-3 py-2 text-xs font-medium border-b border-[var(--vscode-input-border)] bg-[var(--vscode-sideBar-background)] flex items-center gap-2"
            style={{ color: 'var(--vscode-sideBarTitle-foreground)' }}
          >
            <FileSearch className="w-3.5 h-3.5 opacity-70 flex-shrink-0" />
            <span className="font-mono overflow-x-auto whitespace-nowrap flex-1 min-w-0">
              {result.patterns.length === 1
                ? result.patterns[0]
                : `${result.patterns.length} patterns`}
            </span>
            <span className="ml-auto opacity-50 font-normal flex-shrink-0">
              {result.totalFiles} {result.totalFiles === 1 ? 'file' : 'files'}
            </span>
          </div>

          {/* Content */}
          <div className="max-h-[400px] overflow-y-auto">
            {isEmpty ? (
              <div className="px-3 py-4 text-xs text-center opacity-50 italic">
                No files found
              </div>
            ) : (
              <div>
                {result.sortBy === 'extension' ? (
                  // Grouped by extension
                  Object.entries(groupedResults).map(([extension, files]) => (
                    <div key={extension}>
                      {/* Extension Header */}
                      <div
                        className="px-3 py-1.5 text-xs font-medium bg-[var(--vscode-sideBar-background)] border-b border-[var(--vscode-input-border)]"
                        style={{ color: 'var(--vscode-foreground)' }}
                      >
                        <span className="opacity-70">.{extension}</span>
                        <span className="ml-2 opacity-50 font-normal">
                          ({files.length})
                        </span>
                      </div>

                      {/* Files in this extension */}
                      <div className="py-0.5">
                        {files.map((file, fileIndex) => {
                          const iconConfig = getFileIconConfig(file.name);
                          const Icon = iconConfig.icon;

                          return (
                            <div
                              key={fileIndex}
                              className="flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--vscode-list-hoverBackground)] transition-colors"
                            >
                              <Icon
                                className="w-4 h-4 flex-shrink-0"
                                style={{ color: iconConfig.color }}
                              />
                              <span
                                className="text-sm flex-1 truncate font-mono"
                                style={{ color: 'var(--vscode-foreground)' }}
                              >
                                {file.path}
                              </span>
                              <span
                                className="text-xs opacity-50 flex-shrink-0 font-normal"
                                style={{ color: 'var(--vscode-descriptionForeground)' }}
                              >
                                {formatSize(file.size)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                ) : (
                  // Flat list
                  <div className="py-0.5">
                    {result.results.map((file, fileIndex) => {
                      const iconConfig = getFileIconConfig(file.name);
                      const Icon = iconConfig.icon;

                      return (
                        <div
                          key={fileIndex}
                          className="flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--vscode-list-hoverBackground)] transition-colors"
                        >
                          <Icon
                            className="w-4 h-4 flex-shrink-0"
                            style={{ color: iconConfig.color }}
                          />
                          <span
                            className="text-sm flex-1 truncate font-mono"
                            style={{ color: 'var(--vscode-foreground)' }}
                          >
                            {file.path}
                          </span>
                          <span
                            className="text-xs opacity-50 flex-shrink-0 font-normal"
                            style={{ color: 'var(--vscode-descriptionForeground)' }}
                          >
                            {formatSize(file.size)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Truncation or skip warnings */}
                {(result.truncated || hasSkipped) && (
                  <div className="border-t border-[var(--vscode-input-border)]">
                    {result.truncated && (
                      <div className="px-3 py-2 text-xs text-center opacity-50 italic">
                        Results truncated (showing {result.totalFiles} files)
                      </div>
                    )}
                    {hasSkipped && (
                      <div className="px-3 py-2 text-xs opacity-50">
                        <div className="font-medium mb-1">
                          {result.totalSkipped} {result.totalSkipped === 1 ? 'file' : 'files'} skipped:
                        </div>
                        <div className="space-y-0.5 max-h-24 overflow-y-auto">
                          {result.skippedFiles?.slice(0, 5).map((skipped, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs">
                              <span className="font-mono truncate flex-1">{skipped.file}</span>
                              <span className="italic opacity-70 flex-shrink-0">
                                ({skipped.reason === 'tooLarge' ? 'too large' : 
                                  skipped.reason === 'permissionDenied' ? 'permission denied' : 
                                  'invalid type'})
                              </span>
                            </div>
                          ))}
                          {result.skippedFiles && result.skippedFiles.length > 5 && (
                            <div className="text-xs italic opacity-50">
                              ... and {result.skippedFiles.length - 5} more
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }
    return <div className="text-xs opacity-70">Files found successfully</div>;
  },
});
