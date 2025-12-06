import { FileSearch } from 'lucide-react';
import type { ToolExecutionResult } from '../../types/tool';
import { registerToolPlugin } from './tool-plugin';
import { executeToolViaExtension } from '../tool-utils';
import { getFileIconConfig } from '../../utils/file-icon-mapper';
import { SearchSnippetItem } from '../../components/ui/search-snippet-item';

interface GlobFileResult {
  path: string;
  name: string;
  lines: number;
  type: 'file' | 'folder';
}


interface GlobFileItemProps {
  file: GlobFileResult;
  isExpanded?: boolean;
  onToggle?: () => void;
}

function GlobFileItem({
  file,
}: GlobFileItemProps) {
  const iconConfig = getFileIconConfig(file.name);
  const Icon = iconConfig.icon;

  return (
    <SearchSnippetItem
      path={file.path}
      icon={Icon}
      iconColor={iconConfig.color}
      startLine={0}
      endLine={0}
      chipLabel={`${file.lines} lines`}
      chipStyle={{
        backgroundColor: 'transparent',
        color: 'var(--vscode-descriptionForeground)',
        opacity: 0.7,
        padding: '2px 6px',
        fontSize: '0.75rem',
        fontFamily: 'var(--vscode-editor-font-family)',
      }}
      reason={undefined}
      lines={[]}
      hasCode={false}
      isExpanded={false}
      onToggle={undefined}
    />
  );
}

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

Examples:

1. Find all TypeScript files:
<function_calls>
<invoke name="glob_search">
<parameter name="pattern">**/*.ts</parameter>
</invoke>
</function_calls>

2. Search multiple patterns in parallel:
<function_calls>
<invoke name="glob_search">
<parameter name="pattern">**/*.tsx</parameter>
<parameter name="path">src/components</parameter>
</invoke>
<invoke name="glob_search">
<parameter name="pattern">**/*.ts</parameter>
<parameter name="path">src/hooks</parameter>
</invoke>
<invoke name="glob_search">
<parameter name="pattern">**/*.ts</parameter>
<parameter name="path">src/utils</parameter>
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
- For content search (finding code/text), use grep_search instead
- Use multiple <invoke> blocks within a single <function_calls> to search multiple patterns in parallel`,
    icon: FileSearch,
    usage: 'Find files based on glob patterns',
    formatExample: '<function_calls>\n<invoke name="glob_search">\n<parameter name="pattern">*.ts</parameter>\n<parameter name="path">src</parameter>\n</invoke>\n</function_calls>',
  },
  handler: {
    execute: executeGlobSearch,
  },
  renderer: (data: unknown) => {
    return <GlobSearchRendererComponent data={data} />;
  },
});

function GlobSearchRendererComponent({ data }: { data: unknown }) {
  if (typeof data === 'object' && data !== null) {
    const result = data as {
      patterns: string[];
      searchPath: string;
      totalFiles: number;
      totalSkipped: number;
      results: GlobFileResult[];
      skippedFiles?: Array<{
        file: string;
        reason: 'permissionDenied' | 'tooLarge' | 'invalidType';
      }>;
      truncated: boolean;
      sortBy: 'name' | 'size' | 'extension';
      sortOrder: 'asc' | 'desc';
    };

    // Safety check: ensure results is an array
    const results = Array.isArray(result.results) ? result.results : [];
    const isEmpty = results.length === 0;
    const hasSkipped = result.skippedFiles && result.skippedFiles.length > 0;

    return (
      <div className="rounded-md overflow-hidden border border-[var(--vscode-input-border)] bg-[var(--vscode-editor-background)]">
        {/* Content */}
        <div className="max-h-[400px] overflow-y-auto">
          {isEmpty ? (
            <div className="px-3 py-4 text-xs text-center opacity-50 italic">
              No files found
            </div>
          ) : (
            <div>
              {results.map((file, index) => (
                <GlobFileItem
                  key={index}
                  file={file}
                />
              ))}

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
}

export { GlobFileItem };
