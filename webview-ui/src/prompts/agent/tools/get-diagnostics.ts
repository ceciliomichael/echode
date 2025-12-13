/**
 * Agent Mode - get_diagnostics Instructions
 */

export function getGetDiagnosticsInstructions(): string {
    return `## get_diagnostics
Get linter/compiler errors and warnings.

Parameters:
- path: File or directory to check (optional, defaults to workspace)

When to use:
- Check for errors after edits
- Find type errors
- See lint warnings

Workflow: Edit → get_diagnostics → fix errors → verify`;
}