/**
 * Shared get_diagnostics tool instructions
 * Supports multiple formats for different modes
 */

export interface GetDiagnosticsOptions {
    format?: 'markdown' | 'xml';
}

export function getGetDiagnosticsInstructions(options: GetDiagnosticsOptions = {}): string {
    const { format = 'markdown' } = options;

    if (format === 'xml') {
        return `<tool_usage tool="get_diagnostics">
<summary>Get linter/compiler errors and warnings.</summary>
<params>
*   path: Optional absolute file or directory path used to filter results. Diagnostics are only collected for files that are currently open in the editor.
*   file_pattern: Optional substring filter applied to open file paths.
</params>
<notes>
*   Use after edits to verify code correctness.
*   Helps identify type errors and lint issues.
*   This tool does not scan the entire workspace; it only returns diagnostics for open files.
</notes>
</tool_usage>`;
    }

    return `## get_diagnostics
Get linter/compiler errors and warnings.

Parameters:
- path: Optional absolute file or directory path used to filter results. Diagnostics are only collected for files that are currently open in the editor.
- file_pattern: Optional substring filter applied to open file paths.

When to use:
- Check for errors after edits
- Find type errors
- See lint warnings

Workflow: Edit -> get_diagnostics -> fix errors -> verify`;
}