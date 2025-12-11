/**
 * Agent Mode - get_diagnostics Instructions
 */

export function getGetDiagnosticsInstructions(): string {
    return `## get_diagnostics
Get linter/compiler errors and warnings.

WHEN TO USE:
- Check for errors after edits
- Find type errors
- See lint warnings

Parameters:
- path: File or directory to check (optional, defaults to workspace)

WORKFLOW:
Edit related files (as per mini plan) → get_diagnostics on those paths → fix errors → verify`;
}
