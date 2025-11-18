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
  return executeToolViaExtension('write_file', parameters, signal);
}

// Register write_file tool
registerToolPlugin({
  metadata: {
    id: 'write_file',
    name: 'Write File',
    description: 'Create or overwrite files with content',
    aiDescription: 'Write content to a file. Use this to create new files or update existing ones.',
    icon: FilePlus,
    usage: 'Create or overwrite files with content',
    formatExample: '```tool:write_file\n{"path": "src/app.ts", "content": "console.log(\'Hello\');"}\n```',
  },
  handler: {
    execute: executeWriteFile,
  },
  renderer: (data: unknown) => {
    if (typeof data === 'object' && data !== null && 'path' in data) {
      const result = data as { path: string; bytesWritten?: number };
      return (
        <div className="space-y-1">
          <div className="text-xs font-semibold opacity-70">
            File written: {result.path}
          </div>
          {result.bytesWritten !== undefined && (
            <div className="text-xs opacity-60">
              {result.bytesWritten} bytes written
            </div>
          )}
        </div>
      );
    }
    return <div className="text-xs opacity-70">File written successfully</div>;
  },
});
