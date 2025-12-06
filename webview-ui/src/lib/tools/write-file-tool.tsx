import { FilePlus } from 'lucide-react';
import type { ToolExecutionResult } from '../../types/tool';
import { registerToolPlugin } from './tool-plugin';
import { executeToolViaExtension, type ChatMode } from '../tool-utils';

/**
 * Write File Tool
 */
async function executeWriteFile(
  parameters: Record<string, unknown>,
  signal?: AbortSignal,
  _onStatusChange?: unknown,
  _onProgress?: unknown,
  mode?: ChatMode,
): Promise<ToolExecutionResult> {
  return executeToolViaExtension('write_to_file', parameters, signal, undefined, mode);
}

// Register write_to_file tool
registerToolPlugin({
  metadata: {
    id: 'write_to_file',
    name: 'Write File',
    description: 'Create NEW files or perform complete rewrites (never small edits)',
    aiDescription: `## write_to_file
Description: Request to write content to a file. This tool should ONLY be used in these specific scenarios:
1. **Creating NEW files** that don't exist yet.
2. **Complete rewrites** where the entire file structure has changed significantly.
3. **Large refactors where the file is now SHORTER** - when a file has been heavily refactored and the new version is significantly shorter, making a full rewrite more efficient than multiple diffs.
4. **Fallback when apply_diff keeps failing** - if apply_diff repeatedly fails due to content mismatch, use write_to_file to rewrite the entire file instead.

For ALL other modifications to existing files, you MUST use apply_diff instead for targeted edits.

If the file exists, it will be overwritten. If it doesn't exist, it will be created. This tool will automatically create any directories needed to write the file.

Parameters:
- path: (required) The path of the file to write to (relative to workspace)
- content: (required) The content to write to the file. When performing a full rewrite of an existing file or creating a new one, ALWAYS provide the COMPLETE intended content of the file, without any truncation or omissions. You MUST include ALL parts of the file, even if they haven't been modified. Do NOT include line numbers in the content though, just the actual content of the file.

Usage:
<function_calls>
<invoke name="write_to_file">
<parameter name="path">File path here</parameter>
<parameter name="content">
Your file content here
</parameter>
</invoke>
</function_calls>

Example: Requesting to write to config.json
<function_calls>
<invoke name="write_to_file">
<parameter name="path">config.json</parameter>
<parameter name="content">
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
</parameter>
</invoke>
</function_calls>

Example: Creating multiple files in parallel (use multiple invoke blocks within one function_calls block):
<function_calls>
<invoke name="write_to_file">
<parameter name="path">src/components/Button.tsx</parameter>
<parameter name="content">
export function Button() { return <button>Click</button>; }
</parameter>
</invoke>
<invoke name="write_to_file">
<parameter name="path">src/components/Input.tsx</parameter>
<parameter name="content">
export function Input() { return <input />; }
</parameter>
</invoke>
</function_calls>

IMPORTANT: Tool Safety and Usage Guidelines:
- ONLY use for: (1) NEW files, (2) complete rewrites, or (3) large refactors where file is now shorter
- NEVER use write_to_file for small, localized edits to existing files; use apply_diff instead
- Binary files (.png, .jpg, .ico, .zip, etc.) are BLOCKED automatically
- Files with null bytes or control characters are BLOCKED automatically
- Maximum file size: 5MB
- After creating or rewriting a file, use read_file to verify the result before continuing.`,
    icon: FilePlus,
    usage: 'NEW files, complete rewrites, or when refactored file is shorter',
    formatExample: '<function_calls>\n<invoke name="write_to_file">\n<parameter name="path">src/new-file.ts</parameter>\n<parameter name="content">// new file content</parameter>\n</invoke>\n</function_calls>',
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
