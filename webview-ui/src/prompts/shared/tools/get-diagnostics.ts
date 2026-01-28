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
*   path: File or directory to check (Absolute path required, defaults to workspace)
</params>
<notes>
*   Use after edits to verify code correctness.
*   Helps identify type errors and lint issues.
</notes>
</tool_usage>`;
    }

    return `## get_diagnostics
Get linter/compiler errors and warnings.

Parameters:
- path: File or directory to check (Absolute path required, defaults to workspace)

When to use:
- Check for errors after edits
- Find type errors
- See lint warnings

Workflow: Edit -> get_diagnostics -> fix errors -> verify`;
}