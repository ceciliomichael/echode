import * as vscode from 'vscode';

export interface DiagnosticInfo {
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
 * 
 * This function ensures the document is visible to trigger "lazy" LSPs.
 */
export async function getFileDiagnosticsAfterEdit(
    uri: vscode.Uri,
    waitTimeoutMs = 2000
): Promise<DiagnosticInfo[]> {
    let resolved = false;
    let disposable: vscode.Disposable | undefined;

    // 1. Setup the listener BEFORE doing anything else to catch early updates
    const diagnosticChangePromise = new Promise<void>((resolve) => {
        disposable = vscode.languages.onDidChangeDiagnostics((e) => {
            // Use case-insensitive comparison to handle Windows paths correctly
            if (e.uris.some(u => u.fsPath.toLowerCase() === uri.fsPath.toLowerCase())) {
                if (!resolved) {
                    resolved = true;
                    // Give a buffer for full diagnostic set to populate after the event triggers
                    setTimeout(resolve, 100);
                }
            }
        });
    });

    // 2. Ensure the document is open and visible to trigger LSPs
    try {
        const doc = await vscode.workspace.openTextDocument(uri);
        
        // Explicitly show the document to force LSPs that require visibility to compute diagnostics
        // We check if it's already visible to avoid unnecessary UI updates
        if (!vscode.window.visibleTextEditors.some(e => e.document.uri.toString() === uri.toString())) {
            await vscode.window.showTextDocument(doc, { 
                preserveFocus: true, 
                preview: true 
            });
        }
    } catch (e) {
        console.warn(`[DiagnosticsUtils] Could not open/show document ${uri.fsPath}:`, e);
    }

    // 3. Wait for the diagnostics update OR the timeout
    // We race the change promise against a timeout promise.
    // Importantly, the timeout counts mostly for the LS processing time.
    
    const timeoutPromise = new Promise<void>((resolve) => {
        setTimeout(() => {
            resolve();
        }, waitTimeoutMs);
    });

    await Promise.race([diagnosticChangePromise, timeoutPromise]);

    // Cleanup listener
    if (disposable) {
        disposable.dispose();
    }

    // 4. Get diagnostics for the file
    // Even if we timed out, we still fetch whatever is available
    const diagnostics = vscode.languages.getDiagnostics(uri);

    // Only include errors and warnings (AI confuses info/hints as problems)
    const results: DiagnosticInfo[] = diagnostics
        .filter(d =>
            d.severity === vscode.DiagnosticSeverity.Error ||
            d.severity === vscode.DiagnosticSeverity.Warning
        )
        .map(d => ({
            line: d.range.start.line + 1,
            character: d.range.start.character,
            severity: severityToString(d.severity),
            message: d.message,
            source: d.source,
            code: typeof d.code === 'object' ? d.code.value : d.code,
        }));

    return results;
}

export function severityToString(
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

    let result = `\n\n[File saved successfully. Post-save diagnostics detected:]`;
    result += `\n<diagnostics errors="${errors}" warnings="${warnings}">`;
    for (const d of diagnostics) {
        result += `\n  [${d.severity}] Line ${d.line}: ${d.message}${d.source ? ` (${d.source})` : ''}`;
    }
    result += '\n</diagnostics>';

    return result;
}