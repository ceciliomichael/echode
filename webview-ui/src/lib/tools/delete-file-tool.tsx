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
    aiDescription: 'Delete a file from the workspace. This operation moves the file to the trash/recycle bin.',
    icon: Trash2,
    usage: 'Delete a file from the workspace',
    formatExample: '<delete_file>\n<path>src/old-file.ts</path>\n</delete_file>',
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
