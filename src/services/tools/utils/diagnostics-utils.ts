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
 * Checks if a file exists on disk
 */
export async function fileExists(uri: vscode.Uri): Promise<boolean> {
    try {
        await vscode.workspace.fs.stat(uri);
        return true;
    } catch {
        return false;
    }
}

/**
 * Waits for diagnostics to update for a specific file after an edit,
 * then returns the diagnostics for that file.
 * 
 * This function opens the document in the workspace (backend) to trigger LSPs.
 * It also refreshes stale diagnostics from deleted/modified files.
 */
export async function getFileDiagnosticsAfterEdit(
    uri: vscode.Uri,
    waitTimeoutMs = 5000
): Promise<DiagnosticInfo[]> {
    // 0. Check if file exists - if not, return empty (clears stale diagnostics)
    const exists = await fileExists(uri);
    if (!exists) {
        console.log(`[DiagnosticsUtils] File does not exist: ${uri.fsPath}, returning empty diagnostics`);
        return [];
    }

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

    // 2. Ensure the document is open in the workspace (backend) to trigger LSPs
    try {
        // Just open the text document model without showing it in the editor UI
        // This triggers "didOpen" in the LSP which should start diagnostic computation
        await vscode.workspace.openTextDocument(uri);
    } catch (e) {
        console.warn(`[DiagnosticsUtils] Could not open document ${uri.fsPath}:`, e);
        // If we can't open the file, return empty diagnostics
        if (disposable) {
            disposable.dispose();
        }
        return [];
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

/**
 * Gets URIs of files that have stale diagnostics (file no longer exists).
 * These should be filtered out when collecting diagnostics.
 */
export async function getStaleFileUris(): Promise<Set<string>> {
    const allDiagnostics = vscode.languages.getDiagnostics();
    const staleUris = new Set<string>();
    
    // Check each file that has diagnostics - if it no longer exists, mark as stale
    const checkPromises = allDiagnostics.map(async ([uri]) => {
        const exists = await fileExists(uri);
        if (!exists) {
            staleUris.add(uri.toString());
        }
    });
    
    await Promise.all(checkPromises);
    return staleUris;
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