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
Description: Request to read the contents of one or multiple files in a single call. The tool outputs line-numbered content (e.g. "1: const x = 1") for easy reference when creating diffs or discussing code. Use line ranges to efficiently read specific portions of large files. Supports text extraction from PDF and DOCX files, but may not handle other binary files properly.

**DEFAULT BEHAVIOR: Reads first 100 lines maximum per file.** Use offset/limit parameters to read different sections or more lines.

Parameters:
- path1: (required) First file path WITH extension relative to workspace (e.g., src/app.ts, README.md)
- path2: (optional) Second file path - for reading multiple files efficiently in parallel
- path3: (optional) Third file path
- path4: (optional) Fourth file path
- path5: (optional) Fifth file path
- offset: (optional) Start line number (default: 1, 1-based) - applies to all files
- limit: (optional) Number of lines to read (default: 100) - applies to all files

Usage Format (CRITICAL - Follow XML syntax exactly):
<function_call>
<tool_name>read_file</tool_name>
<path1>path/to/file1.ext</path1>
<path2>path/to/file2.ext</path2>
<offset>start_line</offset>
<limit>line_count</limit>
</function_call>

IMPORTANT XML SYNTAX RULES:
- Each path MUST be on its own line with proper closing tags: </path1>, </path2>, etc.
- NEVER put multiple paths in a single parameter
- NEVER use backslashes in closing tags (correct: </path1>, incorrect: <\\path1>)
- Each file path goes in its own numbered parameter (path1, path2, path3, etc.)

Examples:

1. Reading first 100 lines of a single file (default):
<function_call>
<tool_name>read_file</tool_name>
<path1>src/app.ts</path1>
</function_call>

2. Reading multiple files in parallel (HIGHLY RECOMMENDED for efficiency):
<function_call>
<tool_name>read_file</tool_name>
<path1>src/components/header.tsx</path1>
<path2>src/components/footer.tsx</path2>
<path3>src/utils/helpers.ts</path3>
</function_call>

3. Reading custom range (lines 101-150) from a single file:
<function_call>
<tool_name>read_file</tool_name>
<path1>src/large.ts</path1>
<offset>101</offset>
<limit>50</limit>
</function_call>

4. Reading entire small file (up to 500 lines):
<function_call>
<tool_name>read_file</tool_name>
<path1>config.json</path1>
<limit>500</limit>
</function_call>

IMPORTANT: You MUST use this Efficient Reading Strategy:
- **ALWAYS use path2, path3, path4, path5 when you need to read multiple files** - this reads them all in parallel for maximum efficiency
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
    if (typeof data === 'object' && data !== null) {
      // Handle multiple files result
      if ('files' in data && Array.isArray((data as { files: unknown[] }).files)) {
        const multiResult = data as { files: Array<{
          content: string;
          path: string;
          startLine?: number;
          endLine?: number;
          totalLines?: number;
        }>; count: number };
        
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
