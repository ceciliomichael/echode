import { Trash2 } from 'lucide-react';
import type { ToolExecutionResult } from '../../types/tool';
import { registerToolPlugin } from './tool-plugin';
import { executeToolViaExtension } from '../tool-utils';
import { TOOL_FUNCTION_CALLS_CLOSE, TOOL_FUNCTION_CALLS_OPEN, TOOL_XML_NAMESPACE } from '../tool-xml';

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
    icon: Trash2,
    usage: 'Delete a file from the workspace',
    formatExample: `${TOOL_FUNCTION_CALLS_OPEN}\n<${TOOL_XML_NAMESPACE}:invoke name="delete_file">\n<${TOOL_XML_NAMESPACE}:parameter name="path">src/old-file.ts</${TOOL_XML_NAMESPACE}:parameter>\n</${TOOL_XML_NAMESPACE}:invoke>\n${TOOL_FUNCTION_CALLS_CLOSE}`,
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
