import { Trash2 } from 'lucide-react';
import type { ToolExecutionResult } from '../../types/tool';
import { registerToolPlugin } from './tool-plugin';
import { executeToolViaExtension } from '../tool-utils';

/**
 * Delete File Tool
 */
async function executeDeleteFile(
  parameters: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<ToolExecutionResult> {
  return executeToolViaExtension('delete_file', parameters, signal);
}

// Register delete_file tool
registerToolPlugin({
  metadata: {
    id: 'delete_file',
    name: 'Delete File',
    description: 'Delete a file from the workspace',
    aiDescription: `## delete_file
Remove a file from workspace. File goes to trash/recycle bin (recoverable).

**Parameters:**
- path: File path to delete (required)

**SAFETY RULES:**

1. **Only delete when explicitly requested** by user
2. **Verify path first**: Use list_files or glob_search to confirm
3. **Never delete speculatively** - only on user instruction
4. **Mention deletion in response**: Let user know what was removed

**COMMON USE CASES:**
- User explicitly says "delete X" or "remove this file"
- Refactoring: removing old files after migration
- Cleanup: removing generated or obsolete files

**DO NOT:**
- Delete files without explicit user request
- Assume files should be deleted
- Delete multiple files without confirmation

**RECOVERY:** Files go to trash/recycle bin, not permanently deleted.`,
    icon: Trash2,
    usage: 'Delete a file from the workspace',
    formatExample: '<function_calls>\n<invoke name="delete_file">\n<parameter name="path">src/old-file.ts</parameter>\n</invoke>\n</function_calls>',
  },
  handler: {
    execute: executeDeleteFile,
  },
  renderer: (data: unknown) => {
    if (typeof data === 'object' && data !== null && 'path' in data) {
      const result = data as { path: string; action?: string };
      return (
        <div className="space-y-1">
          <div className="text-xs font-semibold opacity-70 flex items-center gap-2">
            <Trash2 className="w-3.5 h-3.5" />
            <span>Deleted file: {result.path}</span>
          </div>
        </div>
      );
    }
    return <div className="text-xs opacity-70">File deleted successfully</div>;
  },
});
