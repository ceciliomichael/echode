import { FileDiff } from 'lucide-react';
import type { ToolExecutionResult } from '../../types/tool';
import { registerToolPlugin } from './tool-plugin';
import { executeToolViaExtension } from '../tool-utils';
import { DiffViewer } from '../../components/ui/diff-viewer';

async function executePatchFile(
  parameters: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<ToolExecutionResult> {
  return executeToolViaExtension('patch_file', parameters, signal);
}

registerToolPlugin({
  metadata: {
    id: 'patch_file',
    name: 'Patch File',
    description: 'Apply unified diff patches to files',
    aiDescription: 'Apply structured diff/patch changes to files using unified diff format. More precise and reliable than edit_file for complex line-based modifications. Takes a diff/patch content as input with line numbers and context.',
    icon: FileDiff,
    usage: 'Apply unified diff patches to files',
    formatExample: '<patch_file>\n<path>src/app.ts</path>\n<patch>--- a/src/app.ts\n+++ b/src/app.ts\n@@ -10,7 +10,8 @@ function example() {\n   const x = 1;\n-  const y = 2;\n+  const y = 3;\n+  const z = 4;\n   return x + y;\n }</patch>\n</patch_file>',
  },
  handler: {
    execute: executePatchFile,
  },
  renderer: (data: unknown) => {
    if (typeof data === 'object' && data !== null) {
      const result = data as {
        path: string;
        hunksApplied: number;
        linesAdded: number;
        linesRemoved: number;
        originalContent: string;
        newContent: string;
        truncated?: boolean;
      };

      return (
        <div className="space-y-2">
          <div className="text-xs opacity-70">
            <span className="font-semibold">Patch applied:</span> {result.hunksApplied} {result.hunksApplied === 1 ? 'hunk' : 'hunks'}, 
            <span style={{ color: 'var(--vscode-gitDecoration-addedResourceForeground)' }}> +{result.linesAdded}</span>
            <span style={{ color: 'var(--vscode-gitDecoration-deletedResourceForeground)' }}> -{result.linesRemoved}</span>
          </div>
          <div className="rounded-md overflow-hidden border border-[var(--vscode-input-border)]">
            <DiffViewer
              oldContent={result.originalContent}
              newContent={result.newContent}
              fileName={result.path}
              viewOnly={false}
            />
          </div>
          {result.truncated && (
            <div className="text-xs opacity-50">
              (Content truncated for display)
            </div>
          )}
        </div>
      );
    }
    return <div className="text-xs opacity-70">Patch applied successfully</div>;
  },
});
