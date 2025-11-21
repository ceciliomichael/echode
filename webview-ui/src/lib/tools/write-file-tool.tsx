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
    description: 'Create or overwrite files with content',
    aiDescription: 'Write content to a file. Use this to create new files or update existing ones.',
    icon: FilePlus,
    usage: 'Create or overwrite files with content',
    formatExample: '<function_call>\n<tool_name>write_to_file</tool_name>\n<path>src/app.ts</path>\n<content>console.log(\'Hello\');</content>\n</function_call>',
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
