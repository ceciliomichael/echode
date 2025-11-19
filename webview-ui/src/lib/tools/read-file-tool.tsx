import { FileText } from 'lucide-react';
import type { ToolExecutionResult } from '../../types/tool';
import { registerToolPlugin } from './tool-plugin';
import { executeToolViaExtension } from '../tool-utils';

/**
 * Read File Tool
 */
async function executeReadFile(
  parameters: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<ToolExecutionResult> {
  return executeToolViaExtension('read_file', parameters, signal);
}

// Register read_file tool
registerToolPlugin({
  metadata: {
    id: 'read_file',
    name: 'Read File',
    description: 'Read file content from workspace',
    aiDescription: 'Read the contents of a file. Use this when you need to examine existing code or files. DO NOT use this for directories; use list_files instead.',
    icon: FileText,
    usage: 'Read file content with optional line range',
    formatExample: '```tool:read_file\n{"path": "src/app.ts"}\n```',
  },
  handler: {
    execute: executeReadFile,
  },
  renderer: (data: unknown) => {
    if (typeof data === 'object' && data !== null && 'content' in data) {
      const result = data as { content: string; path: string };
      return (
        <div className="space-y-2">
          <div className="text-xs font-semibold opacity-70">
            File: {result.path}
          </div>
          <pre
            className="text-xs font-mono whitespace-pre-wrap overflow-x-auto p-2 rounded"
            style={{
              backgroundColor: 'var(--vscode-textCodeBlock-background)',
              color: 'var(--vscode-editor-foreground)',
            }}
          >
            {result.content}
          </pre>
        </div>
      );
    }
    return <div className="text-xs opacity-70">File read successfully</div>;
  },
});
