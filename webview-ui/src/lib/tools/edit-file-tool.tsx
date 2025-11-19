import { FileEdit } from 'lucide-react';
import type { ToolExecutionResult } from '../../types/tool';
import { registerToolPlugin } from './tool-plugin';
import { executeToolViaExtension } from '../tool-utils';
import { DiffViewer } from '../../components/ui/diff-viewer';

/**
 * Edit File Tool
 */
async function executeEditFile(
  parameters: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<ToolExecutionResult> {
  return executeToolViaExtension('edit_file', parameters, signal);
}

// Register edit_file tool
registerToolPlugin({
  metadata: {
    id: 'edit_file',
    name: 'Edit File',
    description: 'Edit files using find-and-replace operations',
    aiDescription: 'Edit files by performing precise find-and-replace operations. Supports multiple edits in a single operation.',
    icon: FileEdit,
    usage: 'Edit files using find-and-replace operations',
    formatExample: '```tool:edit_file\n{"path": "src/app.ts", "edits": [{"oldString": "const x = 1", "newString": "const x = 2"}]}\n```',
  },
  handler: {
    execute: executeEditFile,
  },
  renderer: (data: unknown) => {
    if (typeof data === 'object' && data !== null) {
      const result = data as {
        path: string;
        editsApplied: number;
        edits: Array<{
          oldString: string;
          newString: string;
          replaceAll: boolean;
        }>;
        originalContent: string;
        newContent: string;
      };

      return (
        <div className="rounded-md overflow-hidden border border-[var(--vscode-input-border)]">
          <DiffViewer
            oldContent={result.originalContent}
            newContent={result.newContent}
            fileName={result.path}
            viewOnly={false}
          />
        </div>
      );
    }
    return <div className="text-xs opacity-70">File edited successfully</div>;
  },
});
