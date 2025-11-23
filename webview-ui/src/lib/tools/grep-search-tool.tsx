import { Search } from 'lucide-react';
import type { ToolExecutionResult } from '../../types/tool';
import { registerToolPlugin } from './tool-plugin';
import { executeToolViaExtension } from '../tool-utils';
import { getFileIconConfig } from '../../utils/file-icon-mapper';

/**
 * Grep Search Tool
 */
async function executeGrepSearch(
  parameters: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<ToolExecutionResult> {
  return executeToolViaExtension('grep_search', parameters, signal);
}

// Register grep_search tool
registerToolPlugin({
  metadata: {
    id: 'grep_search',
    name: 'Grep Search',
    description: 'Search for patterns across workspace files',
    aiDescription: `## grep_search
Description: Search for text patterns and content across workspace files using regex or plain text queries. Use this tool to locate specific code, functions, classes, or text across your entire codebase or within specific directories.

Parameters:
- query: (required) The search pattern (text or regex)
- path: (optional) Directory to search in (default: workspace root)
- isRegex: (optional) Set to true for regex patterns, false for plain text (default: false)
- caseSensitive: (optional) Case-sensitive search (default: false)
- includes: (optional) Glob patterns to filter files (e.g., *.ts, *.tsx, src/**)

Usage:
<function_call>
<tool_name>grep_search</tool_name>
<query>search pattern</query>
<path>directory</path>
<isRegex>false</isRegex>
<caseSensitive>false</caseSensitive>
</function_call>

Examples:

1. Finding all occurrences of a function name:
<function_call>
<tool_name>grep_search</tool_name>
<query>handleSubmit</query>
<path>src</path>
</function_call>

2. Regex search for imports:
<function_call>
<tool_name>grep_search</tool_name>
<query>import.*from.*react</query>
<path>src</path>
<isRegex>true</isRegex>
</function_call>

3. Search in specific file types:
<function_call>
<tool_name>grep_search</tool_name>
<query>interface User</query>
<includes>*.ts,*.tsx</includes>
</function_call>

IMPORTANT: Search Strategy:
- Use specific function/class names for better results (e.g., "handleSubmit" not "function")
- Set isRegex=true ONLY when you need regex patterns
- Use includes parameter to limit search to specific file types when appropriate
- After finding matches, use read_file to examine the full context of the file`,
    icon: Search,
    usage: 'Search for patterns across workspace files',
    formatExample: '<function_call>\n<tool_name>grep_search</tool_name>\n<query>function</query>\n<path>src</path>\n<caseSensitive>false</caseSensitive>\n</function_call>',
  },
  handler: {
    execute: executeGrepSearch,
  },
  renderer: (data: unknown) => {
    if (typeof data === 'object' && data !== null) {
      const result = data as {
        query: string;
        isRegex: boolean;
        caseSensitive: boolean;
        totalMatches: number;
        filesWithMatches: number;
        results: Array<{
          file: string;
          matches: Array<{
            line: number;
            column: number;
            text: string;
            matchText: string;
          }>;
        }>;
        truncated: boolean;
      };

      const isEmpty = result.results.length === 0;

      return (
        <div className="rounded-md overflow-hidden border border-[var(--vscode-input-border)] bg-[var(--vscode-editor-background)]">
          {/* Header */}
          <div
            className="px-3 py-2 text-xs font-medium border-b border-[var(--vscode-input-border)] bg-[var(--vscode-sideBar-background)] flex items-center gap-2"
            style={{ color: 'var(--vscode-sideBarTitle-foreground)' }}
          >
            <Search className="w-3.5 h-3.5 opacity-70 flex-shrink-0" />
            <span className="font-mono overflow-x-auto whitespace-nowrap flex-1 min-w-0">{result.query}</span>
            <span className="ml-auto opacity-50 font-normal flex-shrink-0">
              {result.totalMatches} {result.totalMatches === 1 ? 'match' : 'matches'}
            </span>
          </div>

          {/* Content */}
          <div className="max-h-[400px] overflow-y-auto">
            {isEmpty ? (
              <div className="px-3 py-4 text-xs text-center opacity-50 italic">
                No matches found
              </div>
            ) : (
              <div>
                {result.results.map((fileResult, fileIndex) => {
                  const iconConfig = getFileIconConfig(fileResult.file);
                  const Icon = iconConfig.icon;

                  return (
                    <div key={fileIndex}>
                      {/* File Header */}
                      <div
                        className="flex items-center gap-2 px-3 py-1.5 bg-[var(--vscode-sideBar-background)] border-b border-[var(--vscode-input-border)]"
                      >
                        <Icon
                          className="w-3.5 h-3.5 flex-shrink-0"
                          style={{ color: iconConfig.color }}
                        />
                        <span
                          className="text-xs font-medium truncate"
                          style={{ color: 'var(--vscode-foreground)' }}
                        >
                          {fileResult.file}
                        </span>
                        <span
                          className="text-xs ml-auto opacity-50 font-normal"
                          style={{ color: 'var(--vscode-descriptionForeground)' }}
                        >
                          {fileResult.matches.length}
                        </span>
                      </div>

                      {/* Matches */}
                      <div className="py-0.5">
                        {fileResult.matches.map((match, matchIndex) => (
                          <div
                            key={matchIndex}
                            className="flex items-start gap-3 px-2 py-0.5 hover:bg-[var(--vscode-list-hoverBackground)] transition-colors group"
                          >
                            <span
                              className="text-xs font-mono flex-shrink-0 opacity-40 text-right select-none w-6 group-hover:opacity-100 transition-opacity"
                              style={{ 
                                color: 'var(--vscode-editorLineNumber-foreground)'
                              }}
                            >
                              {match.line}
                            </span>
                            <code
                              className="text-xs font-mono flex-1 overflow-x-auto whitespace-nowrap"
                              style={{ color: 'var(--vscode-editor-foreground)' }}
                            >
                              {match.text}
                            </code>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                
                {result.truncated && (
                  <div className="px-3 py-2 text-xs text-center opacity-50 italic border-t border-[var(--vscode-input-border)]">
                    Results truncated
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }
    return <div className="text-xs opacity-70">Search completed successfully</div>;
  },
});
