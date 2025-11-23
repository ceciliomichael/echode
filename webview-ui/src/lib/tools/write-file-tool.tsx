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
    description: 'Create NEW files, complete rewrites, or when refactored file is shorter',
    aiDescription: `## write_to_file
Description: Request to write content to a file. This tool should ONLY be used in these specific scenarios:
1. **Creating NEW files** that don't exist yet
2. **Complete rewrites** where the entire file structure has changed significantly
3. **Large refactors where the file is now SHORTER** - when a file has been heavily refactored and the new version is significantly shorter, making a full rewrite more efficient than multiple diffs
4. **Fallback when apply_diff fails repeatedly** - if apply_diff fails 2-3 times due to content mismatch, use write_to_file to rewrite the entire file instead

For ALL other modifications to existing files, use apply_diff instead for targeted edits.

If the file exists, it will be overwritten. If it doesn't exist, it will be created. This tool will automatically create any directories needed to write the file.

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
- ONLY use for: (1) NEW files, (2) complete rewrites, or (3) large refactors where file is now shorter
- For targeted edits to existing files, use apply_diff instead
- Binary files (.png, .jpg, .ico, .zip, etc.) are BLOCKED automatically
- Files with null bytes or control characters are BLOCKED automatically
- Maximum file size: 5MB
- After creating a new file, use read_file to verify it was created correctly`,
    icon: FilePlus,
    usage: 'NEW files, complete rewrites, or when refactored file is shorter',
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
