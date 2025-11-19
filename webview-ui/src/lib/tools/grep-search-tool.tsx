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
    aiDescription: 'Search for text patterns across workspace files with regex support, file filtering, and context lines.',
    icon: Search,
    usage: 'Search for patterns across workspace files',
    formatExample: '```tool:grep_search\n{"query": "function", "path": "src", "caseSensitive": false}\n```',
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
            <Search className="w-3.5 h-3.5 opacity-70" />
            <span>{result.query}</span>
            <span className="ml-auto opacity-50 font-normal">
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
                              className="text-xs font-mono flex-1 whitespace-pre-wrap break-all"
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
