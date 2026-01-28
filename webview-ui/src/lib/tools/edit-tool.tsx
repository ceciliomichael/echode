import { FilePenLine } from 'lucide-react';
import type { ToolExecutionResult } from '../../types/tool';
import { registerToolPlugin } from './tool-plugin';
import { executeToolViaExtension, type ChatMode } from '../tool-utils';
import { TOOL_FUNCTION_CALLS_CLOSE, TOOL_FUNCTION_CALLS_OPEN, TOOL_XML_NAMESPACE } from '../tool-xml';

async function executeEdit(
  parameters: Record<string, unknown>,
  signal?: AbortSignal,
  _onStatusChange?: unknown,
  _onProgress?: unknown,
  mode?: ChatMode,
): Promise<ToolExecutionResult> {
  return executeToolViaExtension('edit', parameters, signal, undefined, mode);
}

registerToolPlugin({
  metadata: {
    id: 'edit',
    name: 'Edit',
    description: 'Replace exact text in an existing file',
    aiDescription: `Targeted edits to existing files by exact string replacement.

Parameters:
- file_path: File path (relative to workspace)
- old_string: The exact text to replace (must be unique unless replace_all is true)
- new_string: Replacement text (must be different from old_string)
- explanation: Description of the change
- replace_all: Optional boolean to replace all occurrences

Rules:
- old_string must match exactly (including whitespace).
- If old_string appears multiple times, set replace_all=true or make old_string more specific.
- Do not batch multiple unrelated edits into one call.`,
    icon: FilePenLine,
    usage: 'Targeted edits to existing files',
    formatExample: `${TOOL_FUNCTION_CALLS_OPEN}\n<${TOOL_XML_NAMESPACE}:invoke name="edit">\n<${TOOL_XML_NAMESPACE}:parameter name="file_path">src/file.ts</${TOOL_XML_NAMESPACE}:parameter>\n<${TOOL_XML_NAMESPACE}:parameter name="old_string">old text</${TOOL_XML_NAMESPACE}:parameter>\n<${TOOL_XML_NAMESPACE}:parameter name="new_string">new text</${TOOL_XML_NAMESPACE}:parameter>\n<${TOOL_XML_NAMESPACE}:parameter name="explanation">Explain why</${TOOL_XML_NAMESPACE}:parameter>\n</${TOOL_XML_NAMESPACE}:invoke>\n${TOOL_FUNCTION_CALLS_CLOSE}`,
  },
  handler: {
    execute: executeEdit,
  },
  renderer: (data: unknown) => {
    if (typeof data === 'object' && data !== null && 'path' in data) {
      const result = data as { path: string; message?: string };
      return (
        <div className="space-y-1">
          <div className="text-xs font-semibold opacity-70">Edited: {result.path}</div>
          {result.message && <div className="text-xs opacity-60">{result.message}</div>}
        </div>
      );
    }
    return <div className="text-xs opacity-70">Edit applied successfully</div>;
  },
});
