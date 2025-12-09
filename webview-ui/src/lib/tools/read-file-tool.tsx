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
Read contents of files. Outputs line-numbered content for easy reference.

**CRITICAL: You MUST read_file BEFORE editing any file. Never edit from memory.**

Parameters:
- path: (required) File path with extension
- offset: (optional) Start line (1-based, default: 1)
- limit: (optional) Lines to read (default: 500)

**INTELLIGENT USAGE:**

1. **Before ANY change**: Always read first to get current state
   
   read_file → verify content → then plan or apply changes using the appropriate tools
   

2. **Large files (>300 lines)**: Use offset/limit strategically
   - Need function at line 150? → offset:140, limit:50
   - Scanning for pattern? → grep_search first, then read_file on matches

3. **Parallel reads**: Read multiple unrelated files at once
   
   <function_calls>
   <invoke name="read_file"><parameter name="path">src/a.ts</parameter></invoke>
   <invoke name="read_file"><parameter name="path">src/b.ts</parameter></invoke>
   <invoke name="read_file"><parameter name="path">src/c.ts</parameter></invoke>
   </function_calls>
   

4. **For precise modifications**: When a later step needs exact search/replace, copy the source content EXACTLY from read_file output (character-for-character)

**ERROR HANDLING:**
- "Cannot read directory" → Use list_files instead
- "File not found" → Verify path with glob_search
- No content returned → Check if file is binary (blocked automatically)

**DO NOT:**
- Read same file/range repeatedly unless file changed
- Assume file contents from earlier reads—always re-read before edit
- Call read_file on paths without extensions (use list_files for directories)`,
    icon: FileText,
    usage: 'Read file content - ONLY for paths WITH extensions',
    formatExample: '<function_calls>\n<invoke name="read_file">\n<parameter name="path">src/app.ts</parameter>\n</invoke>\n</function_calls>',
  },
  handler: {
    execute: executeReadFile,
  },
  renderer: (data: unknown) => {
    if (typeof data === 'object' && data !== null) {
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
