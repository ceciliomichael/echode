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
        description: 'PREFERRED method for all targeted edits to existing files',
        aiDescription: `## apply_diff
**PREFERRED tool for targeted edits to existing files.**

**CRITICAL WORKFLOW:**
1. read_file first → get exact current content
2. Copy SEARCH content EXACTLY from read_file output (character-for-character)
3. Call apply_diff with copied SEARCH + your REPLACE

**Parameters:**
- path: File path (relative to workspace)
- diff: SEARCH/REPLACE blocks

**Format:**
<<<<<<< SEARCH
:start_line:N
-------
[EXACT content copied from read_file - must match perfectly]
=======
[your replacement content]
>>>>>>> REPLACE

**SUCCESS PATTERNS:**

1. **Single edit**: Read file → Copy exact lines → Apply diff
2. **Multiple edits in same file**: Use multiple SEARCH/REPLACE blocks in one call
3. **After success**: Move on unless verification explicitly needed

**FAILURE RECOVERY:**

When apply_diff fails:
1. **1st failure**: Re-read file with read_file (content may have changed)
2. **Copy fresh**: Use exact characters from new read_file output
3. **Retry**: apply_diff with fresh SEARCH content
4. **2nd failure**: SWITCH to write_to_file for complete rewrite

**COMMON MISTAKES TO AVOID:**
- Using outdated/remembered content → always re-read first
- Wrong indentation in SEARCH → must match file exactly
- Missing/extra whitespace → copy character-by-character
- Wrong :start_line → verify line numbers from read_file

**WHEN TO USE write_to_file INSTEAD:**
- Creating NEW files (path doesn't exist)
- Complete file rewrites (>50% changed)
- After 2 failed apply_diff attempts
- File is now significantly SHORTER after refactor`,
        icon: FilePenLine,
        usage: 'PREFERRED for all targeted edits to existing files',
        formatExample: '<function_calls>\n<invoke name="apply_diff">\n<parameter name="path">src/file.ts</parameter>\n<parameter name="diff">\n<<<<<<< SEARCH\n:start_line:10\n-------\nold code\n=======\nnew code\n>>>>>>> REPLACE\n</parameter>\n</invoke>\n</function_calls>',
    },
    handler: {
        execute: executeApplyDiff,
    },
    renderer: (data: unknown) => {
        // Renderer is now handled by tool-result-renderer.tsx using DiffViewer
        // This is kept for backward compatibility but shouldn't be called
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
