/**
 * Apply Diff Tool - Applies search/replace diffs to files
 */

import * as vscode from 'vscode';
import { ITool, ToolExecutionResult, ChatMode } from './tool.interface';
import { getWorkspaceRoot, resolveAbsolutePath } from './utils/workspace-utils';
import { unescapeHtmlEntities } from '../../utils/text-normalization';
import { MultiSearchReplaceDiffStrategy } from './apply-diff';
import { createUnifiedDiff } from '../../utils/diff-generator';

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

            // Open document to get robust access to content/ranges
            let document: vscode.TextDocument;
            try {
                document = await vscode.workspace.openTextDocument(uri);
            } catch (error) {
                return { success: false, error: `File does not exist or cannot be opened: ${absolutePath}` };
            }

            // Read original content from document (handles dirty state correctly)
            const originalContent = document.getText();

            // Apply diff matches
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

            // Apply changes via WorkspaceEdit
            if (diffResult.content) {
                const edit = new vscode.WorkspaceEdit();

                // Calculate full range of the document
                const lastLine = document.lineAt(document.lineCount - 1);
                const fullRange = new vscode.Range(0, 0, lastLine.lineNumber, lastLine.range.end.character);

                edit.replace(uri, fullRange, diffResult.content);
                const applied = await vscode.workspace.applyEdit(edit);

                if (!applied) {
                    return { success: false, error: 'Failed to apply WorkspaceEdit to document' };
                }

                // Ensure changes are saved to disk
                const saved = await document.save();
                if (!saved) {
                    // Start retry loop for saving (sometimes fails if file system is busy)
                    let retryCount = 0;
                    while (retryCount < 3 && !await document.save()) {
                        retryCount++;
                        await new Promise(r => setTimeout(r, 100)); // 100ms wait
                    }
                    if (retryCount >= 3) {
                        console.warn('[APPLY_DIFF] Warning: Document save returned false after retries');
                    }
                }
            }

            // Ensure file is visible
            try {
                await vscode.window.showTextDocument(document, {
                    preview: false,
                    preserveFocus: true,
                });
                console.log('[APPLY_DIFF] File opened in tab for diagnostics');
            } catch (openError) {
                console.warn('[APPLY_DIFF] Could not open file in tab:', openError);
            }

            let partFailHint = "";
            if (diffResult.failParts && diffResult.failParts.length > 0) {
                partFailHint = ` (some diff parts failed - use read_file to verify)`;
            }

            // Re-read the actual content after save to capture any changes from formatters/linters
            // (e.g., goimports removing unused imports, prettier formatting, etc.)
            let actualNewContent = diffResult.content || '';
            try {
                // Small delay to allow formatters to finish
                await new Promise(r => setTimeout(r, 100));
                // Re-open the document to get fresh content
                const refreshedDocument = await vscode.workspace.openTextDocument(uri);
                actualNewContent = refreshedDocument.getText();
            } catch (refreshError) {
                console.warn('[APPLY_DIFF] Could not refresh document content:', refreshError);
            }

            // Calculate line count and add mode-specific reminder for large files
            const lineCount = actualNewContent.split(/\r?\n/).length;
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
                    newContent: actualNewContent,
                    lineCount,
                    largeFileReminder,
                    refactorNotice,
                    diff: createUnifiedDiff(originalContent, actualNewContent, filePath),
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