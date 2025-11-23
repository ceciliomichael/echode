import { FilePlus } from 'lucide-react';
import type { ToolExecutionResult } from '../../types/tool';
import { registerToolPlugin } from './tool-plugin';
import { executeToolViaExtension } from '../tool-utils';

/**
 * Write File Tool
 */
async function executeWriteFile(
  parameters: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<ToolExecutionResult> {
  return executeToolViaExtension('write_to_file', parameters, signal);
}

// Register write_to_file tool
registerToolPlugin({
  metadata: {
    id: 'write_to_file',
    name: 'Write File',
    description: 'Create NEW files or complete rewrites only',
    aiDescription: `## write_to_file
Description: Request to write content to a file. This tool is primarily used for **creating new files** or for scenarios where a **complete rewrite of an existing file is intentionally required**. If the file exists, it will be overwritten. If it doesn't exist, it will be created. This tool will automatically create any directories needed to write the file.

Parameters:
- path: (required) The path of the file to write to (relative to workspace)
- content: (required) The content to write to the file. When performing a full rewrite of an existing file or creating a new one, ALWAYS provide the COMPLETE intended content of the file, without any truncation or omissions. You MUST include ALL parts of the file, even if they haven't been modified. Do NOT include line numbers in the content though, just the actual content of the file.

Usage:
<function_call>
<tool_name>write_to_file</tool_name>
<path>File path here</path>
<content>
Your file content here
</content>
</function_call>

Example: Requesting to write to config.json
<function_call>
<tool_name>write_to_file</tool_name>
<path>config.json</path>
<content>
{
  "apiEndpoint": "https://api.example.com",
  "theme": {
    "primaryColor": "#007bff",
    "secondaryColor": "#6c757d"
  },
  "features": {
    "darkMode": true,
    "notifications": true
  }
}
</content>
</function_call>

IMPORTANT: Tool Safety and Usage Guidelines:
- Use for creating NEW files or modifying existing files
- Binary files (.png, .jpg, .ico, .zip, etc.) are BLOCKED automatically
- Files with null bytes or control characters are BLOCKED automatically
- Maximum file size: 5MB
- After creating a new file, use read_file to verify it was created correctly`,
    icon: FilePlus,
    usage: 'Create NEW files only - use patch_file for modifications',
    formatExample: '<function_call>\n<tool_name>write_to_file</tool_name>\n<path>src/new-file.ts</path>\n<content>// new file content</content>\n</function_call>',
  },
  handler: {
    execute: executeWriteFile,
  },
  renderer: (data: unknown) => {
    if (typeof data === 'object' && data !== null && 'path' in data) {
      const result = data as { path: string; action?: string };
      return (
        <div className="space-y-1">
          <div className="text-xs font-semibold opacity-70">
            {result.action === 'created' ? 'File created' : 'File modified'}: {result.path}
          </div>
        </div>
      );
    }
    return <div className="text-xs opacity-70">File written successfully</div>;
  },
});
