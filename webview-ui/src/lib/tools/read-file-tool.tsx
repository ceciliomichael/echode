import { FileText } from 'lucide-react';
import type { ToolExecutionResult } from '../../types/tool';
import { registerToolPlugin } from './tool-plugin';
import { executeToolViaExtension, type ChatMode } from '../tool-utils';

/**
 * Read File Tool
 */
async function executeReadFile(
  parameters: Record<string, unknown>,
  signal?: AbortSignal,
  _onStatusChange?: unknown,
  _onProgress?: unknown,
  mode?: ChatMode,
): Promise<ToolExecutionResult> {
  return executeToolViaExtension('read_file', parameters, signal, undefined, mode);
}

// Register read_file tool
registerToolPlugin({
  metadata: {
    id: 'read_file',
    name: 'Read File',
    description: 'Read file contents - ONLY for paths WITH file extensions',
    aiDescription: `## read_file
Description: Read contents of one or multiple files. Outputs line-numbered content for easy reference.

**DEFAULT: Reads first 500 lines per file.** Use offset/limit for different sections.

Parameters:
- path: (required for single file) File path with extension (e.g., src/app.ts)
- paths: (required for multiple files) JSON array of file paths (e.g., ["src/a.ts", "src/b.ts"])
- offset: (optional) Start line number (1-based, default: 1)
- limit: (optional) Number of lines to read (default: 500)
- check_lints: (optional) If true, fetch and return lint/compile diagnostics for the file. Defaults to false.

Examples:

1. Single file:
<function_calls>
<invoke name="read_file">
<parameter name="path">src/app.ts</parameter>
</invoke>
</function_calls>

2. Multiple files (parallel read):
<function_calls>
<invoke name="read_file">
<parameter name="paths">["src/components/header.tsx", "src/components/footer.tsx", "src/utils/helpers.ts"]</parameter>
</invoke>
</function_calls>

3. Custom line range:
<function_calls>
<invoke name="read_file">
<parameter name="path">src/large.ts</parameter>
<parameter name="offset">101</parameter>
<parameter name="limit">50</parameter>
</invoke>
</function_calls>

IMPORTANT:
- Use \`paths\` array when reading multiple related files - reads in parallel for efficiency
- File paths MUST have extensions - if no extension, use list_files first
- If "Cannot read directory" error: use list_files on that path first`,
    icon: FileText,
    usage: 'Read file content - ONLY for paths WITH extensions',
    formatExample: '<function_calls>\n<invoke name="read_file">\n<parameter name="path">src/app.ts</parameter>\n</invoke>\n</function_calls>',
  },
  handler: {
    execute: executeReadFile,
  },
  renderer: (data: unknown) => {
    if (typeof data === 'object' && data !== null) {
      // Handle multiple files result
      if ('files' in data && Array.isArray((data as { files: unknown[] }).files)) {
        const multiResult = data as {
          files: Array<{
            content: string;
            path: string;
            startLine?: number;
            endLine?: number;
            totalLines?: number;
          }>; count: number
        };

        return (
          <div className="space-y-3">
            <div className="text-xs font-semibold opacity-70">
              {multiResult.count} file{multiResult.count > 1 ? 's' : ''} read
            </div>
            {multiResult.files.map((file, index) => {
              const lineRangeText = file.startLine && file.endLine
                ? `Lines ${file.startLine}-${file.endLine}`
                : file.totalLines
                  ? `${file.totalLines} lines`
                  : '';

              return (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold opacity-70">
                    <span>File: {file.path}</span>
                    {lineRangeText && <span>{lineRangeText}</span>}
                  </div>
                  <pre
                    className="text-xs font-mono whitespace-pre-wrap overflow-x-auto p-2 rounded"
                    style={{
                      backgroundColor: 'var(--vscode-textCodeBlock-background)',
                      color: 'var(--vscode-editor-foreground)',
                    }}
                  >
                    {file.content}
                  </pre>
                </div>
              );
            })}
          </div>
        );
      }

      // Handle single file result
      if ('content' in data) {
        const result = data as {
          content: string;
          path: string;
          startLine?: number;
          endLine?: number;
          totalLines?: number;
        };

        const lineRangeText = result.startLine && result.endLine
          ? `Lines ${result.startLine}-${result.endLine}`
          : result.totalLines
            ? `${result.totalLines} lines`
            : '';

        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold opacity-70">
              <span>File: {result.path}</span>
              {lineRangeText && <span>{lineRangeText}</span>}
            </div>
            <pre
              className="text-xs font-mono whitespace-pre-wrap overflow-x-auto p-2 rounded"
              style={{
                backgroundColor: 'var(--vscode-textCodeBlock-background)',
                color: 'var(--vscode-editor-foreground)',
              }}
            >
              {result.content}
            </pre>
          </div>
        );
      }
    }
    return <div className="text-xs opacity-70">File read successfully</div>;
  },
});
