/**
 * Apply Diff Tool - Applies search/replace diffs to files
 */

import * as vscode from 'vscode';
import { ITool, ToolExecutionResult, ChatMode } from './tool.interface';
import { getWorkspaceRoot, resolveAbsolutePath } from './utils/workspace-utils';
import { unescapeHtmlEntities } from '../../utils/text-normalization';
import { capturePreDiagnostics, detectNewProblemsAfterEdit } from '../diagnostics';
import { MultiSearchReplaceDiffStrategy } from './apply-diff';

/**
 * Tool for applying diff patches to files
 */
export class ApplyDiffTool implements ITool {
    name = 'apply_diff';
    private diffStrategy = new MultiSearchReplaceDiffStrategy();
    private applyDiffFailureCounts = new Map<string, number>();

    async execute(
        parameters: Record<string, unknown>,
        _onProgress?: unknown,
        _signal?: AbortSignal,
        mode?: ChatMode
    ): Promise<ToolExecutionResult> {
        const filePath = parameters.path as string;
        let diffContent = parameters.diff as string;

        if (!filePath) {
            return { success: false, error: 'File path is required' };
        }

        if (!diffContent) {
            return { success: false, error: 'Diff content is required' };
        }

        // Unescape HTML entities if needed
        diffContent = unescapeHtmlEntities(diffContent);

        // Convert escaped \n, \t, \r sequences ONLY when the diff content appears to be
        // a single packed line with no real newlines. This avoids corrupting
        // intentional "\\n" inside string literals in normal multi-line patches.
        const hasActualNewlines = diffContent.includes('\n');
        const hasEscapedSequences = /\\[ntr]/.test(diffContent);
        if (!hasActualNewlines && hasEscapedSequences) {
            console.log('[APPLY_DIFF] Converting escaped sequences (\\n, \\t, \\r) to actual characters for single-line packed diff');
            diffContent = diffContent
                .replace(/\\n/g, '\n')
                .replace(/\\t/g, '\t')
                .replace(/\\r/g, '\r');
        }

        try {
            const workspaceRoot = getWorkspaceRoot();
            if (!workspaceRoot) {
                return { success: false, error: 'No workspace folder open' };
            }

            const absolutePath = resolveAbsolutePath(filePath, workspaceRoot);
            const uri = vscode.Uri.file(absolutePath);

            // Check if file exists
            try {
                await vscode.workspace.fs.stat(uri);
            } catch {
                return { success: false, error: `File does not exist at path: ${absolutePath}` };
            }

            // Read original content
            const fileContent = await vscode.workspace.fs.readFile(uri);
            const originalContent = Buffer.from(fileContent).toString('utf8');

            // Capture pre-diagnostics BEFORE applying diff
            const preDiagnostics = capturePreDiagnostics();
            console.log('[APPLY_DIFF] Captured pre-diagnostics');

            // Apply diff
            const diffResult = await this.diffStrategy.applyDiff(
                originalContent,
                diffContent,
                parseInt(diffContent.match(/:start_line:(\d+)/)?.[1] ?? ""),
            );

            if (!diffResult.success) {
                const currentCount = (this.applyDiffFailureCounts.get(absolutePath) ?? 0) + 1;
                this.applyDiffFailureCounts.set(absolutePath, currentCount);
                let formattedError = "";
                if (diffResult.failParts && diffResult.failParts.length > 0) {
                    for (const failPart of diffResult.failParts) {
                        if (failPart.success) { continue; }
                        const errorDetails = failPart.details ? JSON.stringify(failPart.details, null, 2) : "";
                        formattedError = `<error_details>\n${failPart.error}${errorDetails ? `\n\nDetails:\n${errorDetails}` : ""}\n</error_details>`;
                    }
                } else {
                    const errorDetails = diffResult.details ? JSON.stringify(diffResult.details, null, 2) : "";
                    formattedError = `Unable to apply diff to file: ${absolutePath}\n\n<error_details>\n${diffResult.error}${errorDetails ? `\n\nDetails:\n${errorDetails}` : ""}\n</error_details>`;
                }
                if (currentCount >= 2) {
                    formattedError += "\n\n<notice>apply_diff has failed multiple times for this file. Switch to write_to_file to rewrite the entire file instead.</notice>";
                }
                return { success: false, error: formattedError };
            }

            // Reset failure counter on success
            this.applyDiffFailureCounts.delete(absolutePath);

            // Check for no-op: diff produced identical content
            if (diffResult.content === originalContent) {
                console.log('[APPLY_DIFF] No-op detected: diff produced identical content');
                return {
                    success: true,
                    data: {
                        message: `no_change: Diff applied but content unchanged for ${filePath}`,
                        action: 'no_change',
                        path: filePath,
                        absolutePath,
                        oldContent: originalContent,
                        newContent: diffResult.content,
                    },
                };
            }

            // Write new content only if it differs
            if (diffResult.content) {
                await vscode.workspace.fs.writeFile(uri, Buffer.from(diffResult.content, 'utf8'));
            }

            // Open the file in a tab for visibility (without stealing focus)
            try {
                await vscode.window.showTextDocument(uri, {
                    preview: false,
                    preserveFocus: true,
                });
                console.log('[APPLY_DIFF] File opened in tab for diagnostics');
            } catch (openError) {
                console.warn('[APPLY_DIFF] Could not open file in tab:', openError);
            }

            // Detect new problems after the edit
            const newProblemsMessage = await detectNewProblemsAfterEdit(preDiagnostics, workspaceRoot);
            if (newProblemsMessage) {
                console.log('[APPLY_DIFF] New problems detected after edit');
            }

            let partFailHint = "";
            if (diffResult.failParts && diffResult.failParts.length > 0) {
                partFailHint = ` (some diff parts failed - use read_file to verify)`;
            }

            // Calculate line count and add mode-specific reminder for large files
            const lineCount = diffResult.content ? diffResult.content.split(/\r?\n/).length : 0;
            let largeFileReminder: string | undefined;
            if (lineCount > 300 && (mode === 'agent' || mode === 'general' || mode === undefined)) {
                largeFileReminder = `[FILE NOW ${lineCount} LINES] This file exceeds the 300-line threshold after modification. Consider refactoring into smaller, focused modules to maintain code quality.`;
            }

            const refactorNotice = largeFileReminder
                ? {
                    type: 'large_file',
                    lineCount,
                    mode,
                    message: largeFileReminder,
                }
                : undefined;

            return {
                success: true,
                data: {
                    message: `Successfully applied diff to ${filePath}${partFailHint}`,
                    action: 'modified',
                    path: filePath,
                    absolutePath,
                    oldContent: originalContent,
                    newContent: diffResult.content,
                    lineCount,
                    largeFileReminder,
                    refactorNotice,
                    newProblemsMessage: newProblemsMessage || undefined,
                },
            };

        } catch (error) {
            return {
                success: false,
                error: `Error applying diff: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }
}