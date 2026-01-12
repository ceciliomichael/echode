import { FilePenLine } from 'lucide-react';
import type { ToolExecutionResult } from '../../types/tool';
import { registerToolPlugin } from './tool-plugin';
import { executeToolViaExtension, type ChatMode } from '../tool-utils';

/**
 * Apply Diff Tool
 */
async function executeApplyDiff(
    parameters: Record<string, unknown>,
    signal?: AbortSignal,
    _onStatusChange?: unknown,
    _onProgress?: unknown,
    mode?: ChatMode,
): Promise<ToolExecutionResult> {
    return executeToolViaExtension('apply_diff', parameters, signal, undefined, mode);
}

// Register apply_diff tool
registerToolPlugin({
    metadata: {
        id: 'apply_diff',
        name: 'Apply Diff',
        description: 'Targeted edits to existing files',
        aiDescription: `Targeted edits to existing files using SEARCH/REPLACE blocks.

HARD REQUIREMENT (DO NOT BREAK):
- Exactly ONE <<<<<<< SEARCH ... ======= ... >>>>>>> REPLACE block per apply_diff invocation.
- If you need multiple changes (even in the same file), emit multiple <invoke name="apply_diff"> blocks.
- Do NOT include multiple SEARCH blocks inside a single diff.
- Do NOT use an edits parameter/array.

Parameters:
- path: File path (relative to workspace)
- diff: Single SEARCH/REPLACE block (use multiple invocations for multiple changes)

Format:
<<<<<<< SEARCH
:start_line:N
-------
[exact content to find]
=======
[replacement content]
>>>>>>> REPLACE`,
        icon: FilePenLine,
        usage: 'Targeted edits to existing files',
        formatExample: '<function_calls>\n<invoke name="apply_diff">\n<parameter name="path">src/file.ts</parameter>\n<parameter name="diff">\n<<<<<<< SEARCH\n:start_line:10\n-------\nold code\n=======\nnew code\n>>>>>>> REPLACE\n</parameter>\n</invoke>\n</function_calls>',
    },
    handler: {
        execute: executeApplyDiff,
    },
    renderer: (data: unknown) => {
        if (typeof data === 'object' && data !== null && 'path' in data) {
            const result = data as { path: string; message?: string };
            return (
                <div className="space-y-1">
                    <div className="text-xs font-semibold opacity-70">
                        Applied diff to: {result.path}
                    </div>
                    {result.message && (
                        <div className="text-xs opacity-60">{result.message}</div>
                    )}
                </div>
            );
        }
        return <div className="text-xs opacity-70">Diff applied successfully</div>;
    },
});
