/**
 * Review Mode - get_diagnostics tool instructions
 */

export function getGetDiagnosticsInstructions(): string {
    return `## get_diagnostics
Get TypeScript/linter errors and warnings from the workspace.

Parameters:
- path: File or directory to check (optional, defaults to workspace)

Usage for Code Review:
- Catch type errors that indicate bugs
- Find lint violations
- Identify unused variables/imports
- Detect potential runtime errors

Tips:
- Run on the scope you're reviewing
- Type errors often reveal deeper logic issues
- Warnings may indicate code smells`;
}