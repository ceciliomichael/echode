import { FilePlus } from 'lucide-react';
import type { ToolExecutionResult } from '../../types/tool';
import { registerToolPlugin } from './tool-plugin';
import { executeToolViaExtension, type ChatMode } from '../tool-utils';
import { TOOL_FUNCTION_CALLS_CLOSE, TOOL_FUNCTION_CALLS_OPEN, TOOL_XML_NAMESPACE } from '../tool-xml';

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
    formatExample: `${TOOL_FUNCTION_CALLS_OPEN}\n<${TOOL_XML_NAMESPACE}:invoke name="write_to_file">\n<${TOOL_XML_NAMESPACE}:parameter name="path">src/new-file.ts</${TOOL_XML_NAMESPACE}:parameter>\n<${TOOL_XML_NAMESPACE}:parameter name="content">// file content</${TOOL_XML_NAMESPACE}:parameter>\n</${TOOL_XML_NAMESPACE}:invoke>\n${TOOL_FUNCTION_CALLS_CLOSE}`,
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
