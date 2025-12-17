import * as vscode from 'vscode';

interface DiagnosticInfo {
    line: number;
    character: number;
    severity: 'Error' | 'Warning' | 'Information' | 'Hint';
    message: string;
    source?: string;
    code?: string | number;
}

/**
 * Waits for diagnostics to update for a specific file after an edit,
 * then returns the diagnostics for that file.
 */
export async function getFileDiagnosticsAfterEdit(
    uri: vscode.Uri,
    waitTimeoutMs = 2000
): Promise<DiagnosticInfo[]> {
    // Wait for diagnostics to update
    await waitForDiagnosticsUpdate(uri, waitTimeoutMs);

    // Get diagnostics for the file
    const diagnostics = vscode.languages.getDiagnostics(uri);

    // Convert all diagnostics to our format (include all severities)
    const results: DiagnosticInfo[] = diagnostics.map(d => ({
        line: d.range.start.line + 1,
        character: d.range.start.character,
        severity: severityToString(d.severity),
        message: d.message,
        source: d.source,
        code: typeof d.code === 'object' ? d.code.value : d.code,
    }));

    return results;
}

/**
 * Waits for diagnostics to update for a specific file URI.
 * Resolves when onDidChangeDiagnostics fires for that URI, or after timeout.
 */
async function waitForDiagnosticsUpdate(uri: vscode.Uri, timeoutMs: number): Promise<void> {
    return new Promise<void>((resolve) => {
        let resolved = false;

        const disposable = vscode.languages.onDidChangeDiagnostics((e) => {
            if (e.uris.some(u => u.fsPath === uri.fsPath)) {
                if (!resolved) {
                    resolved = true;
                    disposable.dispose();
                    // Give a tiny buffer for full diagnostic set to populate
                    setTimeout(resolve, 50);
                }
            }
        });

        // Timeout fallback
        setTimeout(() => {
            if (!resolved) {
                resolved = true;
                disposable.dispose();
                resolve();
            }
        }, timeoutMs);
    });
}

function severityToString(
    severity: vscode.DiagnosticSeverity
): 'Error' | 'Warning' | 'Information' | 'Hint' {
    switch (severity) {
        case vscode.DiagnosticSeverity.Error:
            return 'Error';
        case vscode.DiagnosticSeverity.Warning:
            return 'Warning';
        case vscode.DiagnosticSeverity.Information:
            return 'Information';
        case vscode.DiagnosticSeverity.Hint:
            return 'Hint';
        default:
            return 'Information';
    }
}

/**
 * Formats diagnostics into a string for AI consumption
 */
export function formatDiagnosticsForAI(diagnostics: DiagnosticInfo[]): string {
    if (diagnostics.length === 0) {
        return '';
    }

    const errors = diagnostics.filter(d => d.severity === 'Error').length;
    const warnings = diagnostics.filter(d => d.severity === 'Warning').length;
    const info = diagnostics.filter(d => d.severity === 'Information').length;
    const hints = diagnostics.filter(d => d.severity === 'Hint').length;

    let result = `\n\n<diagnostics errors="${errors}" warnings="${warnings}" info="${info}" hints="${hints}">`;
    for (const d of diagnostics) {
        result += `\n  [${d.severity}] Line ${d.line}: ${d.message}${d.source ? ` (${d.source})` : ''}`;
    }
    result += '\n</diagnostics>';

    return result;
}
