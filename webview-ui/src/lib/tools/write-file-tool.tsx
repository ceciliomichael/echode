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
Create NEW files or complete file rewrites.

**DECISION TREE - When to use:**
\`\`\`
File exists?
├── NO → write_to_file ✓ (creates new file + directories)
└── YES → How much is changing?
    ├── Small section (<30 lines) → apply_diff ✓
    ├── Large changes (>50%) → write_to_file ✓
    ├── File is now SHORTER after refactor → write_to_file ✓
    └── apply_diff failed twice → write_to_file ✓
\`\`\`

**Parameters:**
- path: File path (relative to workspace)
- content: COMPLETE file content (no truncation, no placeholders)

**REQUIREMENTS:**
- Content must be COMPLETE - include ALL parts of file
- No line numbers in content
- No placeholders like "// ... rest of code"
- No truncation like "// existing code unchanged"
- No omissions - every line must be present

**PARALLEL CREATION:**
Create multiple files at once:
\`\`\`xml
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
