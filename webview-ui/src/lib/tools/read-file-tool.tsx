import { FileText } from 'lucide-react';
import type { ToolExecutionResult } from '../../types/tool';
import { registerToolPlugin } from './tool-plugin';
import { executeToolViaExtension } from '../tool-utils';

/**
 * Read File Tool
 */
async function executeReadFile(
  parameters: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<ToolExecutionResult> {
  return executeToolViaExtension('read_file', parameters, signal);
}

// Register read_file tool
registerToolPlugin({
  metadata: {
    id: 'read_file',
    name: 'Read File',
    description: 'Read a single file from workspace',
    aiDescription: 'Read the contents of a file. For large files (>1000 lines), use offset and limit parameters. DO NOT use this for directories; use list_files instead.',
    icon: FileText,
    usage: 'Read file content with optional offset/limit for large files',
    formatExample: '<read_file>\n<path>src/app.ts</path>\n</read_file>\n\nLarge file:\n<read_file>\n<path>src/large.ts</path>\n<offset>1</offset>\n<limit>100</limit>\n</read_file>',
  },
  handler: {
    execute: executeReadFile,
  },
  renderer: (data: unknown) => {
    if (typeof data === 'object' && data !== null && 'content' in data) {
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
    return <div className="text-xs opacity-70">File read successfully</div>;
  },
});
