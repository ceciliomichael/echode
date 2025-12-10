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
    aiDescription: `Create new files or complete file rewrites.

Parameters:
- path: File path (relative to workspace)
- content: COMPLETE file content

Content must be complete - no placeholders or truncation.`,
    icon: FilePlus,
    usage: 'Create new files or complete rewrites',
    formatExample: '<function_calls>\n<invoke name="write_to_file">\n<parameter name="path">src/new-file.ts</parameter>\n<parameter name="content">// file content</parameter>\n</invoke>\n</function_calls>',
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
