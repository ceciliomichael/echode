import { FolderOpen } from 'lucide-react';
import type { ToolExecutionResult } from '../../types/tool';
import { registerToolPlugin } from './tool-plugin';
import { executeToolViaExtension } from '../tool-utils';

/**
 * List Files Tool
 */
async function executeListFiles(
  parameters: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<ToolExecutionResult> {
  return executeToolViaExtension('list_files', parameters, signal);
}

// Register list_files tool
registerToolPlugin({
  metadata: {
    id: 'list_files',
    name: 'List Files',
    description: 'List files and directories in a path',
    aiDescription: 'List files and directories in a workspace path. Use this to explore the project structure.',
    icon: FolderOpen,
    usage: 'List files and directories in a path',
    formatExample: '```tool:list_files\n{"path": "src"}\n```',
  },
  handler: {
    execute: executeListFiles,
  },
  renderer: (data: unknown) => {
    if (typeof data === 'object' && data !== null && 'files' in data) {
      const result = data as { path: string; files: Array<{ name: string; type: string; size?: number }> };
      return (
        <div className="space-y-2">
          <div className="text-xs font-semibold opacity-70">
            Directory: {result.path || 'root'}
          </div>
          <div className="space-y-1">
            {result.files.map((file, index) => (
              <div
                key={index}
                className="text-xs flex items-center gap-2 py-0.5"
                style={{ color: 'var(--vscode-editor-foreground)' }}
              >
                <span className="opacity-60">{file.type === 'directory' ? '📁' : '📄'}</span>
                <span>{file.name}</span>
                {file.size !== undefined && (
                  <span className="opacity-50 text-xs">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }
    return <div className="text-xs opacity-70">Files listed successfully</div>;
  },
});
