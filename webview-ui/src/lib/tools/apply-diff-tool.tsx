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
Description: This is the PREFERRED and DEFAULT method for making ANY targeted modifications to existing files. Request to apply PRECISE, TARGETED edits to an existing file by searching for specific sections of content and replacing them. Use this tool for ALL modifications to existing files unless the file is being completely rewritten or heavily refactored to be shorter.

**CRITICAL PREREQUISITE - YOU MUST DO THIS FIRST:**
Before EVERY apply_diff call, you MUST use read_file to get the current, exact file content. The SEARCH blocks must match the file content EXACTLY (100% match including all whitespace, tabs, and line endings). Working from memory or assumptions will cause the diff to fail.

WORKFLOW:
1. FIRST: Use read_file to get exact current content of the file
2. THEN: Create your SEARCH blocks by copying the EXACT text from the read_file output (including exact whitespace/indentation)
3. FINALLY: Call apply_diff with your precise SEARCH/REPLACE blocks

You can perform multiple distinct search and replace operations within a single apply_diff call by providing multiple SEARCH/REPLACE blocks in the diff parameter. This is the preferred way to make several targeted changes efficiently.

The SEARCH section must exactly match existing content including whitespace and indentation.
When applying the diffs, be extra careful to remember to change any closing brackets or other syntax that may be affected by the diff farther down in the file.
ALWAYS make as many changes in a single 'apply_diff' request as possible using multiple SEARCH/REPLACE blocks

**IMPORTANT - When apply_diff keeps failing:**
If apply_diff fails for the same file with similar SEARCH content, do NOT keep retrying the same diff blindly. Instead:
- First, call read_file again to confirm the latest content and adjust your SEARCH/REPLACE blocks.
- If apply_diff continues to fail even after you correct the SEARCH content, switch to using write_to_file instead to rewrite the entire file.
This is more reliable when:
- The file has been heavily modified and content doesn't match.
- Repeated failures indicate the search content is incorrect.
- The changes are extensive enough that a full rewrite is more practical.

Parameters:
- path: (required) The path of the file to modify (relative to the current workspace directory)
- diff: (required) The search/replace block defining the changes.

Diff format:
\`\`\`
<<<<<<< SEARCH
:start_line: (required) The line number of original content where the search block starts.
-------
[exact content to find including whitespace]
=======
[new content to replace with]
>>>>>>> REPLACE

\`\`\`


Example:

Original file:
\`\`\`
1 | def calculate_total(items):
2 |     total = 0
3 |     for item in items:
4 |         total += item
5 |     return total
\`\`\`

Search/Replace content:
\`\`\`
<<<<<<< SEARCH
:start_line:1
-------
def calculate_total(items):
    total = 0
    for item in items:
        total += item
    return total
=======
def calculate_total(items):
    """Calculate total with 10% markup"""
    return sum(item * 1.1 for item in items)
>>>>>>> REPLACE

\`\`\`

Search/Replace content with multiple edits:
\`\`\`
<<<<<<< SEARCH
:start_line:1
-------
def calculate_total(items):
    sum = 0
=======
def calculate_sum(items):
    sum = 0
>>>>>>> REPLACE

<<<<<<< SEARCH
:start_line:4
-------
        total += item
    return total
=======
        sum += item
    return sum 
>>>>>>> REPLACE
\`\`\`


Usage:
<function_calls>
<invoke name="apply_diff">
<parameter name="path">File path here</parameter>
<parameter name="diff">
Your search/replace content here
You can use multi search/replace block in one diff block, but make sure to include the line numbers for each block.
Only use a single line of '=======' between search and replacement content, because multiple '=======' will corrupt the file.
</parameter>
</invoke>
</function_calls>`,
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
