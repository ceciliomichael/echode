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
Description: Search for text across workspace files. Use this as your primary "search_files" tool to locate functions, symbols, and text inside code.

Recommended simple usage (most cases):
- Always provide:
  - query: the exact name or phrase you are looking for (function, component, variable, etc.)
  - path: the NARROWEST directory that contains the relevant code (e.g. src, src/app, src/components)
- Optionally provide:
  - includes: file globs (e.g. *.ts,*.tsx,*.js) to restrict search
- Leave advanced flags (match modes, semantic options) at their defaults unless you have a VERY specific reason.

Parameters:
- query: (required) Search text. By default treated as plain text, not regex.
- path: (optional) Directory to search in (default: workspace root).
- isRegex: (optional) true to interpret query as regex, false for plain text (default: false). ONLY use true when you explicitly need regex.
- caseSensitive: (optional) Case-sensitive search (default: smart case: if query has uppercase, search is case-sensitive; otherwise case-insensitive).
- includes: (optional) Glob patterns to filter files (e.g., *.ts,*.tsx,src/**).

Usage (XML-style call):
<function_call>
<tool_name>grep_search</tool_name>
<query>handleSubmit</query>
<path>src</path>
<isRegex>false</isRegex>
</function_call>

Examples:

1. Find all references to a function in src:
<function_call>
<tool_name>grep_search</tool_name>
<query>handleSubmit</query>
<path>src</path>
</function_call>

2. Regex search for React imports:
<function_call>
<tool_name>grep_search</tool_name>
<query>import.*from.*react</query>
<path>src</path>
<isRegex>true</isRegex>
</function_call>

3. Search only TypeScript files:
<function_call>
<tool_name>grep_search</tool_name>
<query>interface User</query>
<path>src</path>
<includes>*.ts,*.tsx</includes>
</function_call>

IMPORTANT search strategy:
- Prefer exact identifiers (component names, function names, type names) over generic words.
- Narrow path as much as possible to the relevant area of the project.
- Use includes to limit to relevant file types.
- Avoid regex unless truly required; plain text is more robust.
- After locating matches, use read_file on the specific file(s) to inspect full context before editing.`,
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
