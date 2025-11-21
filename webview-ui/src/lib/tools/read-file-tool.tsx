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
    aiDescription: `Read the contents of a file with LINE NUMBERS. **MANDATORY before any patch_file call** - you need current content with line numbers to build accurate patches.

**DEFAULT BEHAVIOR: Reads first 100 lines maximum**
- If no offset/limit specified → Returns lines 1-100 (or fewer if file is smaller)
- Use offset/limit to read different sections or more lines

**CRITICAL: Content includes line numbers in format "lineNum: content"**
Example output:
\`\`\`
1: import React from 'react';
2: 
3: export function App() {
4:   return <div>Hello</div>;
5: }
\`\`\`

This means:
- Line 1 is \`import React from 'react';\`
- Line 3 is \`export function App() {\`
- Line 4 is \`  return <div>Hello</div>;\` (note the indentation)

**Use these EXACT line numbers in your patch_file @@ headers!**

**CRITICAL REQUIREMENT:**
- Path MUST have a file extension (e.g., \`.ts\`, \`.tsx\`, \`.json\`, \`.md\`)
- If path has NO extension after last \`/\` → Use list_files instead

**When to use:**
- Before modifying a file (patch_file requires this)
- To view/analyze code (first 100 lines by default)
- To find exact line numbers for patches
- Path must be a FILE (with extension), NOT a directory

**DO NOT use read_file if:**
- ❌ Path has no extension (e.g., \`src/app\`, \`api\`, \`components/ui\`)
- ❌ You're not sure if it's a file or directory
- ❌ You just got "Cannot read directory" error

**Error recovery:**
If you get "Cannot read directory 'X'" error:
1. IMMEDIATELY use list_files on that exact path
2. Find the specific file you need from the listing
3. THEN call read_file on that file (which will have an extension)

**Parameters:**
- path: File path WITH extension (not directory)
- offset: Start line number (default: 1)
- limit: Number of lines to read (default: 100)

**Returns:** File content with line numbers formatted as "lineNum: content", plus startLine, endLine, totalLines metadata

**Example:**
<function_call>
<tool_name>read_file</tool_name>
<path>src/app.ts</path>
</function_call>

Custom range:
<function_call>
<tool_name>read_file</tool_name>
<path>src/large.ts</path>
<offset>101</offset>
<limit>50</limit>
</function_call>

More lines (up to 200):
<function_call>
<tool_name>read_file</tool_name>
<path>src/medium.ts</path>
<limit>200</limit>
</function_call>`,
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
