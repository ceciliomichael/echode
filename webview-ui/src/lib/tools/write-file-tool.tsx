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
    aiDescription: `Write entire TEXT file content from scratch. **Strictly text-only, with safety guards.**

**Use ONLY for:**
- Creating brand new TEXT files (source code, config, docs)
- Complete file rewrites (replacing 100% of content)

**DO NOT use for:**
- ❌ Binary files (.png, .jpg, .ico, .zip, etc.) → BLOCKED by tool
- ❌ Files with null bytes or control characters → BLOCKED by tool
- ❌ Modifying existing files → Use patch_file instead
- ❌ Updating parts of a file → Use patch_file instead
- ❌ Files >5MB → BLOCKED by tool

**Safety features:**
- Rejects binary file extensions automatically
- Detects and blocks binary/non-text content
- Verifies written file is readable text
- Size limit: 5MB maximum

**Example (new file):**
<function_call>
<tool_name>write_to_file</tool_name>
<path>src/new-feature.ts</path>
<content>export function newFeature() {
  return 'Hello';
}</content>
</function_call>

**After creating:** Call read_file to verify the file was created correctly and is readable.

**Rule of thumb:** If file exists and you're not rewriting 90%+ → use patch_file`,
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
