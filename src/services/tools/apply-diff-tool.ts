/**
 * Apply Diff Tool - Applies search/replace diffs to files
 */

import * as vscode from 'vscode';
import { ITool, ToolExecutionResult, ChatMode } from './tool.interface';
import { getWorkspaceRoot, resolveAbsolutePath } from './utils/workspace-utils';
import { unescapeHtmlEntities, stripCDataWrapper } from '../../utils/text-normalization';
import { SearchReplaceDiffStrategy } from './apply-diff';
import { createUnifiedDiff } from '../../utils/diff-generator';
import { FileLockManager } from './utils/file-lock-manager';
import { getFileDiagnosticsAfterEdit, formatDiagnosticsForAI } from './utils/diagnostics-utils';

/**
 * Tool for applying diff patches to files
 */
export class ApplyDiffTool implements ITool {
    name = 'apply_diff';
    private diffStrategy = new SearchReplaceDiffStrategy();
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

        // Strip CDATA wrappers that some models (like Gemini) may add
        diffContent = stripCDataWrapper(diffContent);

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

        const workspaceRoot = getWorkspaceRoot();
        if (!workspaceRoot) {
            return { success: false, error: 'No workspace folder open' };
        }

        const absolutePath = resolveAbsolutePath(filePath, workspaceRoot);

        // Acquire lock
        FileLockManager.tryAcquire(absolutePath);

        try {
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

                // Extract the start_line from the diff content to provide context
                const startLineMatch = diffContent.match(/:start_line:\s*(\d+)/);
                const startLine = startLineMatch ? parseInt(startLineMatch[1], 10) : 1;

                // Get context around the attempted edit (50 lines before and after, max 100 lines total)
                const lines = originalContent.split(/\r?\n/);
                const contextStart = Math.max(0, startLine - 51); // 50 lines before
                const contextEnd = Math.min(lines.length, startLine + 50); // 50 lines after
                const contextLines = lines.slice(contextStart, contextEnd);

                // Add line numbers to context
                const numberedContext = contextLines
                    .map((line, idx) => `${contextStart + idx + 1}| ${line}`)
                    .join('\n');

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

                // Add file context to help AI retry without needing read_file
                formattedError += `\n\n<file_context path="${filePath}" lines="${contextStart + 1}-${contextEnd}">\n${numberedContext}\n</file_context>`;

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

            // Wait for and fetch diagnostics after modification
            const diagnostics = await getFileDiagnosticsAfterEdit(uri);
            const diagnosticsText = formatDiagnosticsForAI(diagnostics);

            return {
                success: true,
                data: {
                    message: `Successfully applied diff to ${filePath}${partFailHint}${diagnosticsText}`,
                    action: 'modified',
                    path: filePath,
                    absolutePath,
                    oldContent: originalContent,
                    newContent: actualNewContent,
                    lineCount,
                    largeFileReminder,
                    refactorNotice,
                    diff: createUnifiedDiff(originalContent, actualNewContent, filePath),
                    diagnostics,
                },
            };

        } catch (error) {
            return {
                success: false,
                error: `Error applying diff: ${error instanceof Error ? error.message : String(error)}`,
            };
        } finally {
            // Always release lock
            FileLockManager.release(absolutePath);
        }
    }
}