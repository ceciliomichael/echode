import * as vscode from 'vscode';
import * as path from 'path';
import deepEqual from 'fast-deep-equal';

/**
 * Get new diagnostics that appeared after an operation.
 * Compares old diagnostics with new diagnostics and returns only the new ones.
 */
export function getNewDiagnostics(
    oldDiagnostics: [vscode.Uri, vscode.Diagnostic[]][],
    newDiagnostics: [vscode.Uri, vscode.Diagnostic[]][]
): [vscode.Uri, vscode.Diagnostic[]][] {
    const newProblems: [vscode.Uri, vscode.Diagnostic[]][] = [];
    const oldMap = new Map(oldDiagnostics);

    for (const [uri, newDiags] of newDiagnostics) {
        const oldDiags = oldMap.get(uri) || [];
        const newProblemsForUri = newDiags.filter(
            (newDiag) => !oldDiags.some((oldDiag) => deepEqual(oldDiag, newDiag))
        );

        if (newProblemsForUri.length > 0) {
            newProblems.push([uri, newProblemsForUri]);
        }
    }

    return newProblems;
}

/**
 * Convert diagnostics to a formatted string for LLM consumption.
 * Only includes diagnostics matching the specified severities.
 * Returns empty string if no matching problems found.
 */
export async function diagnosticsToProblemsString(
    diagnostics: [vscode.Uri, vscode.Diagnostic[]][],
    severities: vscode.DiagnosticSeverity[],
    cwd: string,
    includeDiagnosticMessages: boolean = true,
    maxDiagnosticMessages?: number
): Promise<string> {
    // If diagnostics are disabled, return empty string
    if (!includeDiagnosticMessages) {
        return '';
    }

    const documents = new Map<vscode.Uri, vscode.TextDocument>();
    const fileStats = new Map<vscode.Uri, vscode.FileStat>();
    let result = '';

    // If we have a limit, use count-based limiting
    if (maxDiagnosticMessages && maxDiagnosticMessages > 0) {
        let includedCount = 0;
        let totalCount = 0;

        // Flatten all diagnostics with their URIs
        const allDiagnostics: { uri: vscode.Uri; diagnostic: vscode.Diagnostic; formattedText?: string }[] = [];
        for (const [uri, fileDiagnostics] of diagnostics) {
            const filtered = fileDiagnostics.filter((d) => severities.includes(d.severity));
            for (const diagnostic of filtered) {
                allDiagnostics.push({ uri, diagnostic });
                totalCount++;
            }
        }

        // Sort by severity (errors first) and then by line number
        allDiagnostics.sort((a, b) => {
            const severityDiff = a.diagnostic.severity - b.diagnostic.severity;
            if (severityDiff !== 0) {
                return severityDiff;
            }
            return a.diagnostic.range.start.line - b.diagnostic.range.start.line;
        });

        // Process diagnostics up to the count limit
        const includedDiagnostics: typeof allDiagnostics = [];
        for (const item of allDiagnostics) {
            // Stop if we've reached the count limit
            if (includedCount >= maxDiagnosticMessages) {
                break;
            }

            // Format the diagnostic
            const label = getSeverityLabel(item.diagnostic.severity);
            const line = item.diagnostic.range.start.line + 1;
            const source = item.diagnostic.source ? `${item.diagnostic.source} ` : '';

            // Pre-format the diagnostic text
            let diagnosticText = '';
            try {
                let fileStat = fileStats.get(item.uri);
                if (!fileStat) {
                    fileStat = await vscode.workspace.fs.stat(item.uri);
                    fileStats.set(item.uri, fileStat);
                }
                if (fileStat.type === vscode.FileType.File) {
                    const document = documents.get(item.uri) || (await vscode.workspace.openTextDocument(item.uri));
                    documents.set(item.uri, document);
                    const lineContent = document.lineAt(item.diagnostic.range.start.line).text;
                    diagnosticText = `\n- [${source}${label}] ${line} | ${lineContent} : ${item.diagnostic.message}`;
                } else {
                    diagnosticText = `\n- [${source}${label}] 1 | (directory) : ${item.diagnostic.message}`;
                }
            } catch {
                diagnosticText = `\n- [${source}${label}] ${line} | (unavailable) : ${item.diagnostic.message}`;
            }

            item.formattedText = diagnosticText;
            includedDiagnostics.push(item);
            includedCount++;
        }

        // Group included diagnostics by URI for output
        const groupedDiagnostics = new Map<string, { uri: vscode.Uri; diagnostics: typeof allDiagnostics }>();
        for (const item of includedDiagnostics) {
            const key = item.uri.toString();
            if (!groupedDiagnostics.has(key)) {
                groupedDiagnostics.set(key, { uri: item.uri, diagnostics: [] });
            }
            groupedDiagnostics.get(key)!.diagnostics.push(item);
        }

        // Build the output
        for (const { uri, diagnostics: fileDiagnostics } of groupedDiagnostics.values()) {
            const sortedDiagnostics = fileDiagnostics.sort(
                (a, b) => a.diagnostic.range.start.line - b.diagnostic.range.start.line
            );
            if (sortedDiagnostics.length > 0) {
                result += `\n\n${path.relative(cwd, uri.fsPath).replace(/\\/g, '/')}`;
                for (const item of sortedDiagnostics) {
                    result += item.formattedText;
                }
            }
        }

        // Add a note if we hit the limit
        if (totalCount > includedCount) {
            result += `\n\n... ${totalCount - includedCount} more problems omitted to prevent context overflow`;
        }
    } else {
        // No limit, process all diagnostics
        for (const [uri, fileDiagnostics] of diagnostics) {
            const problems = fileDiagnostics
                .filter((d) => severities.includes(d.severity))
                .sort((a, b) => a.range.start.line - b.range.start.line);
            if (problems.length > 0) {
                result += `\n\n${path.relative(cwd, uri.fsPath).replace(/\\/g, '/')}`;
                for (const diagnostic of problems) {
                    const label = getSeverityLabel(diagnostic.severity);
                    const line = diagnostic.range.start.line + 1; // VSCode lines are 0-indexed
                    const source = diagnostic.source ? `${diagnostic.source} ` : '';
                    try {
                        let fileStat = fileStats.get(uri);
                        if (!fileStat) {
                            fileStat = await vscode.workspace.fs.stat(uri);
                            fileStats.set(uri, fileStat);
                        }
                        if (fileStat.type === vscode.FileType.File) {
                            const document = documents.get(uri) || (await vscode.workspace.openTextDocument(uri));
                            documents.set(uri, document);
                            const lineContent = document.lineAt(diagnostic.range.start.line).text;
                            result += `\n- [${source}${label}] ${line} | ${lineContent} : ${diagnostic.message}`;
                        } else {
                            result += `\n- [${source}${label}] 1 | (directory) : ${diagnostic.message}`;
                        }
                    } catch {
                        result += `\n- [${source}${label}] ${line} | (unavailable) : ${diagnostic.message}`;
                    }
                }
            }
        }
    }

    return result.trim();
}

/**
 * Get severity label string
 */
function getSeverityLabel(severity: vscode.DiagnosticSeverity): string {
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
            return 'Diagnostic';
    }
}

/**
 * Configuration for dynamic diagnostic waiting
 */
interface DiagnosticWaitConfig {
    /** Minimum time to wait before checking diagnostics (ms) */
    minWaitMs: number;
    /** Maximum time to wait for diagnostics to stabilize (ms) */
    maxWaitMs: number;
    /** Time of no changes before considering diagnostics stable (ms) */
    stabilityThresholdMs: number;
    /** Interval for polling diagnostic changes (ms) */
    pollIntervalMs: number;
}

const DEFAULT_WAIT_CONFIG: DiagnosticWaitConfig = {
    minWaitMs: 100,
    maxWaitMs: 10000, // 10 seconds max - enough for slow language servers
    stabilityThresholdMs: 500, // Consider stable after 500ms of no changes
    pollIntervalMs: 50, // Check every 50ms
};

/**
 * Capture pre-diagnostics before a file operation
 */
export function capturePreDiagnostics(): [vscode.Uri, vscode.Diagnostic[]][] {
    return vscode.languages.getDiagnostics();
}

/**
 * Wait for diagnostics to stabilize for a specific file.
 * Uses dynamic waiting: monitors for changes and waits until diagnostics
 * haven't changed for a stability threshold period.
 */
async function waitForDiagnosticsToStabilize(
    filePath: string,
    config: DiagnosticWaitConfig = DEFAULT_WAIT_CONFIG
): Promise<void> {
    const normalizedFilePath = path.normalize(filePath).toLowerCase();
    const startTime = Date.now();
    
    return new Promise<void>((resolve) => {
        let lastChangeTime = startTime;
        let lastDiagnosticHash = '';
        let resolved = false;
        let checkIntervalId: NodeJS.Timeout;
        let maxTimeoutId: NodeJS.Timeout;

        const cleanup = () => {
            if (resolved) {
                return;
            }
            resolved = true;
            disposable.dispose();
            clearInterval(checkIntervalId);
            clearTimeout(maxTimeoutId);
            resolve();
        };

        // Get a simple hash of diagnostics for comparison
        const getDiagnosticHash = (): string => {
            const allDiagnostics = vscode.languages.getDiagnostics();
            for (const [uri, diagnostics] of allDiagnostics) {
                const normalizedUri = path.normalize(uri.fsPath).toLowerCase();
                if (normalizedUri === normalizedFilePath) {
                    // Create a hash from diagnostic count and first few messages
                    const messages = diagnostics
                        .slice(0, 5)
                        .map(d => `${d.range.start.line}:${d.message.substring(0, 50)}`)
                        .join('|');
                    return `${diagnostics.length}:${messages}`;
                }
            }
            return '0:';
        };

        // Listen for diagnostic change events
        const disposable = vscode.languages.onDidChangeDiagnostics((e) => {
            for (const uri of e.uris) {
                const normalizedUri = path.normalize(uri.fsPath).toLowerCase();
                if (normalizedUri === normalizedFilePath) {
                    lastChangeTime = Date.now();
                    return;
                }
            }
        });

        // Periodically check if diagnostics have stabilized
        checkIntervalId = setInterval(() => {
            const now = Date.now();
            const elapsed = now - startTime;
            const timeSinceLastChange = now - lastChangeTime;

            // Check if we've passed minimum wait time
            if (elapsed < config.minWaitMs) {
                return;
            }

            // Get current diagnostic state
            const currentHash = getDiagnosticHash();

            // Track if diagnostics changed
            if (currentHash !== lastDiagnosticHash) {
                lastDiagnosticHash = currentHash;
                lastChangeTime = now;
                return;
            }

            // Check if diagnostics have been stable long enough
            if (timeSinceLastChange >= config.stabilityThresholdMs) {
                // Diagnostics are stable - we can proceed
                const diagnosticCount = parseInt(currentHash.split(':')[0], 10);
                console.log(`[DIAGNOSTICS] Stabilized after ${elapsed}ms (${diagnosticCount} diagnostics)`);
                cleanup();
            }
        }, config.pollIntervalMs);

        // Maximum timeout to prevent hanging
        maxTimeoutId = setTimeout(() => {
            const elapsed = Date.now() - startTime;
            console.log(`[DIAGNOSTICS] Max wait reached after ${elapsed}ms`);
            cleanup();
        }, config.maxWaitMs);
    });
}

/**
 * Detect new problems after a file operation.
 * Uses dynamic waiting for diagnostics to stabilize.
 * Returns only errors and warnings.
 */
export async function detectNewProblemsAfterEdit(
    preDiagnostics: [vscode.Uri, vscode.Diagnostic[]][],
    cwd: string,
    _delayMs: number = 0, // Kept for backwards compatibility, but ignored
    maxMessages: number = 50
): Promise<string> {
    // Wait for diagnostics to stabilize (uses dynamic waiting)
    // We need at least one file path to monitor - extract from pre-diagnostics
    if (preDiagnostics.length > 0) {
        const firstFilePath = preDiagnostics[0][0].fsPath;
        await waitForDiagnosticsToStabilize(firstFilePath);
    } else {
        // Fallback: just wait a bit if no pre-diagnostics
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Capture post-diagnostics
    const postDiagnostics = vscode.languages.getDiagnostics();

    // Get only new problems
    const newProblems = getNewDiagnostics(preDiagnostics, postDiagnostics);

    // Format to string - include errors and warnings to help the AI catch potential issues
    const problemsString = await diagnosticsToProblemsString(
        newProblems,
        [
            vscode.DiagnosticSeverity.Error,
            vscode.DiagnosticSeverity.Warning,
        ],
        cwd,
        true,
        maxMessages
    );

    if (problemsString.length > 0) {
        return `\n\nNew problems detected after saving the file:\n${problemsString}`;
    }

    return '';
}

/**
 * Get ALL diagnostics for a specific file after a file operation.
 * Uses dynamic waiting: monitors diagnostic change events and waits
 * until diagnostics stabilize (no changes for a threshold period).
 * This ensures we catch all diagnostics from slow language servers.
 */
export async function getFileDiagnosticsAfterEdit(
    filePath: string,
    cwd: string,
    _delayMs: number = 0, // Kept for backwards compatibility, but ignored
    maxMessages: number = 50
): Promise<string> {
    const normalizedFilePath = path.normalize(filePath).toLowerCase();

    // Wait for diagnostics to stabilize using dynamic waiting
    await waitForDiagnosticsToStabilize(filePath);

    // Get all diagnostics
    const allDiagnostics = vscode.languages.getDiagnostics();

    // Filter to only the specific file
    const fileDiagnostics: [vscode.Uri, vscode.Diagnostic[]][] = [];

    for (const [uri, diagnostics] of allDiagnostics) {
        const normalizedUri = path.normalize(uri.fsPath).toLowerCase();
        if (normalizedUri === normalizedFilePath && diagnostics.length > 0) {
            fileDiagnostics.push([uri, diagnostics]);
            break;
        }
    }

    // Format to string - include all severity levels (errors, warnings, info, hints)
    const problemsString = await diagnosticsToProblemsString(
        fileDiagnostics,
        [
            vscode.DiagnosticSeverity.Error,
            vscode.DiagnosticSeverity.Warning,
            vscode.DiagnosticSeverity.Information,
            vscode.DiagnosticSeverity.Hint,
        ],
        cwd,
        true,
        maxMessages
    );

    if (problemsString.length > 0) {
        return `\n\nFile diagnostics after edit:\n${problemsString}`;
    }

    return '';
}
