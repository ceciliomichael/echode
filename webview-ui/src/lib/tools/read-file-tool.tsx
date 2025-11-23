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
    description: 'Read file contents - ONLY for paths WITH file extensions (defaults to first 100 lines)',
    aiDescription: `## read_file
Description: Request to read the contents of a file. The tool outputs line-numbered content (e.g. "1: const x = 1") for easy reference when creating diffs or discussing code. Use line ranges to efficiently read specific portions of large files. Supports text extraction from PDF and DOCX files, but may not handle other binary files properly.

**DEFAULT BEHAVIOR: Reads first 100 lines maximum.** Use offset/limit parameters to read different sections or more lines.

Parameters:
- path: (required) File path WITH extension relative to workspace (e.g., src/app.ts, README.md)
- offset: (optional) Start line number (default: 1, 1-based)
- limit: (optional) Number of lines to read (default: 100)

Usage:
<function_call>
<tool_name>read_file</tool_name>
<path>path/to/file.ext</path>
<offset>start_line</offset>
<limit>line_count</limit>
</function_call>

Examples:

1. Reading first 100 lines of a file (default):
<function_call>
<tool_name>read_file</tool_name>
<path>src/app.ts</path>
</function_call>

2. Reading custom range (lines 101-150):
<function_call>
<tool_name>read_file</tool_name>
<path>src/large.ts</path>
<offset>101</offset>
<limit>50</limit>
</function_call>

3. Reading entire small file (up to 500 lines):
<function_call>
<tool_name>read_file</tool_name>
<path>config.json</path>
<limit>500</limit>
</function_call>

IMPORTANT: You MUST use this Efficient Reading Strategy:
- You MUST read all related files and implementations together before making changes
- You MUST obtain all necessary context before proceeding with modifications
- You MUST use line ranges to read specific portions of large files (>100 lines), rather than reading entire files when not needed
- File paths MUST have extensions (e.g., .ts, .tsx, .json) - if no extension after last /, use list_files instead

**CRITICAL ERROR RECOVERY:**
If you receive "Cannot read directory" error:
1. IMMEDIATELY use list_files on that exact path
2. Find the specific file you need from the directory listing
3. THEN call read_file on the file with its full path including extension`,
    icon: FileText,
    usage: 'Read file content - ONLY for paths WITH extensions',
    formatExample: '<function_call>\n<tool_name>read_file</tool_name>\n<path>src/app.ts</path>\n</function_call>',
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
