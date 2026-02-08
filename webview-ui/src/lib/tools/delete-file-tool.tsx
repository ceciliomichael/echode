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
  return executeToolViaExtension('delete', parameters, signal);
}

// Register delete tool
registerToolPlugin({
  metadata: {
    id: 'delete',
    name: 'Delete',
    description: 'Delete a file or folder from the workspace',
    icon: Trash2,
    usage: 'Delete a file from the workspace',
    formatExample: `${TOOL_FUNCTION_CALLS_OPEN}\n<${TOOL_XML_NAMESPACE}:invoke name="delete">\n<${TOOL_XML_NAMESPACE}:parameter name="path">src/old-file.ts</${TOOL_XML_NAMESPACE}:parameter>\n<${TOOL_XML_NAMESPACE}:parameter name="type">file</${TOOL_XML_NAMESPACE}:parameter>\n</${TOOL_XML_NAMESPACE}:invoke>\n${TOOL_FUNCTION_CALLS_CLOSE}`,
  },
  handler: {
    execute: executeDeleteFile,
  },
  renderer: (data: unknown) => {
    if (typeof data === 'object' && data !== null && 'path' in data) {
      const result = data as { path: string; type?: string; action?: string };
      const label = result.type === 'folder' ? 'Deleted folder' : 'Deleted file';
      return (
        <div className="space-y-1">
          <div className="text-xs font-semibold opacity-70 flex items-center gap-2">
            <Trash2 className="w-3.5 h-3.5" />
            <span>{label}: {result.path}</span>
          </div>
        </div>
      );
    }
    return <div className="text-xs opacity-70">Deleted successfully</div>;
  },
});
