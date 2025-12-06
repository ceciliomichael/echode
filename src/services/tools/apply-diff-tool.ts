import * as vscode from 'vscode';
import * as path from 'path';
import { distance } from 'fastest-levenshtein';
import { ITool, ToolExecutionResult, ChatMode } from './tool.interface';
import { getWorkspaceRoot, resolveAbsolutePath } from './utils/workspace-utils';
import { unescapeHtmlEntities } from '../../utils/text-normalization';
import { capturePreDiagnostics, detectNewProblemsAfterEdit } from '../diagnostics';

// ==========================================
// Interfaces
// ==========================================

interface DiffResult {
    success: boolean;
    content?: string;
    error?: string;
    failParts?: { success: boolean; error?: string; details?: any }[];
    details?: any;
}

interface DiffStrategy {
    applyDiff(originalContent: string, diffContent: string, startLine?: number, endLine?: number): Promise<DiffResult>;
}

// ==========================================
// Helper Functions (ported from Roo-Code)
// ==========================================

const NORMALIZATION_MAPS = {
    SMART_QUOTES: {
        "\u201C": '"', // Left double quote (U+201C)
        "\u201D": '"', // Right double quote (U+201D)
        "\u2018": "'", // Left single quote (U+2018)
        "\u2019": "'", // Right single quote (U+2019)
    },
    TYPOGRAPHIC: {
        "\u2026": "...", // Ellipsis
        "\u2014": "-", // Em dash
        "\u2013": "-", // En dash
        "\u00A0": " ", // Non-breaking space
    },
};

interface NormalizeOptions {
    smartQuotes?: boolean;
    typographicChars?: boolean;
    extraWhitespace?: boolean;
    trim?: boolean;
}

const DEFAULT_OPTIONS: NormalizeOptions = {
    smartQuotes: true,
    typographicChars: true,
    extraWhitespace: true,
    trim: true,
};

function normalizeString(str: string, options: NormalizeOptions = DEFAULT_OPTIONS): string {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let normalized = str;

    if (opts.smartQuotes) {
        for (const [smart, regular] of Object.entries(NORMALIZATION_MAPS.SMART_QUOTES)) {
            normalized = normalized.replace(new RegExp(smart, "g"), regular);
        }
    }

    if (opts.typographicChars) {
        for (const [typographic, regular] of Object.entries(NORMALIZATION_MAPS.TYPOGRAPHIC)) {
            normalized = normalized.replace(new RegExp(typographic, "g"), regular);
        }
    }

    if (opts.extraWhitespace) {
        normalized = normalized.replace(/\s+/g, " ");
    }

    if (opts.trim) {
        normalized = normalized.trim();
    }

    return normalized;
}

function addLineNumbers(content: string, startLine: number = 1): string {
    if (content === "") {
        return startLine === 1 ? "" : `${startLine} | \n`;
    }

    const lines = content.split("\n");
    const lastLineEmpty = lines[lines.length - 1] === "";
    if (lastLineEmpty) {
        lines.pop();
    }

    const maxLineNumberWidth = String(startLine + lines.length - 1).length;
    const numberedContent = lines
        .map((line, index) => {
            const lineNumber = String(startLine + index).padStart(maxLineNumberWidth, " ");
            return `${lineNumber} | ${line}`;
        })
        .join("\n");

    return numberedContent + "\n";
}

function everyLineHasLineNumbers(content: string): boolean {
    const lines = content.split(/\r?\n/);
    return lines.length > 0 && lines.every((line) => /^\s*\d+\s+\|(?!\|)/.test(line));
}

function stripLineNumbers(content: string, aggressive: boolean = false): string {
    const lines = content.split(/\r?\n/);
    const processedLines = lines.map((line) => {
        const match = aggressive ? line.match(/^\s*(?:\d+\s)?\|\s(.*)$/) : line.match(/^\s*\d+\s+\|(?!\|)\s?(.*)$/);
        return match ? match[1] : line;
    });

    const lineEnding = content.includes("\r\n") ? "\r\n" : "\n";
    let result = processedLines.join(lineEnding);

    if (content.endsWith(lineEnding)) {
        if (!result.endsWith(lineEnding)) {
            result += lineEnding;
        }
    }

    return result;
}

// ==========================================
// MultiSearchReplaceDiffStrategy
// ==========================================

const BUFFER_LINES = 40;

function getSimilarity(original: string, search: string): number {
    if (search === "") {
        return 0;
    }

    const normalizedOriginal = normalizeString(original);
    const normalizedSearch = normalizeString(search);

    if (normalizedOriginal === normalizedSearch) {
        return 1;
    }

    const dist = distance(normalizedOriginal, normalizedSearch);
    const maxLength = Math.max(normalizedOriginal.length, normalizedSearch.length);
    return 1 - dist / maxLength;
}

function fuzzySearch(lines: string[], searchChunk: string, startIndex: number, endIndex: number) {
    let bestScore = 0;
    let bestMatchIndex = -1;
    let bestMatchContent = "";
    const searchLen = searchChunk.split(/\r?\n/).length;

    const midPoint = Math.floor((startIndex + endIndex) / 2);
    let leftIndex = midPoint;
    let rightIndex = midPoint + 1;

    while (leftIndex >= startIndex || rightIndex <= endIndex - searchLen) {
        if (leftIndex >= startIndex) {
            const originalChunk = lines.slice(leftIndex, leftIndex + searchLen).join("\n");
            const similarity = getSimilarity(originalChunk, searchChunk);
            if (similarity > bestScore) {
                bestScore = similarity;
                bestMatchIndex = leftIndex;
                bestMatchContent = originalChunk;
            }
            leftIndex--;
        }

        if (rightIndex <= endIndex - searchLen) {
            const originalChunk = lines.slice(rightIndex, rightIndex + searchLen).join("\n");
            const similarity = getSimilarity(originalChunk, searchChunk);
            if (similarity > bestScore) {
                bestScore = similarity;
                bestMatchIndex = rightIndex;
                bestMatchContent = originalChunk;
            }
            rightIndex++;
        }
    }

    return { bestScore, bestMatchIndex, bestMatchContent };
}

class MultiSearchReplaceDiffStrategy implements DiffStrategy {
    private fuzzyThreshold: number;
    private bufferLines: number;

    constructor(fuzzyThreshold?: number, bufferLines?: number) {
        this.fuzzyThreshold = fuzzyThreshold ?? 1.0;
        this.bufferLines = bufferLines ?? BUFFER_LINES;
    }

    private unescapeMarkers(content: string): string {
        return content
            .replace(/^\\<<<<<<</gm, "<<<<<<<")
            .replace(/^\\=======/gm, "=======")
            .replace(/^\\>>>>>>>/gm, ">>>>>>>")
            .replace(/^\\-------/gm, "-------")
            .replace(/^\\:end_line:/gm, ":end_line:")
            .replace(/^\\:start_line:/gm, ":start_line:");
    }

    private validateMarkerSequencing(diffContent: string): { success: boolean; error?: string } {
        enum State {
            START,
            AFTER_SEARCH,
            AFTER_SEPARATOR,
        }
        const state = { current: State.START, line: 0 };

        const SEARCH_PATTERN = /^<<<<<<< SEARCH>?$/;
        const SEARCH = SEARCH_PATTERN.source.replace(/[\^$]/g, "");
        const SEP = "=======";
        const REPLACE = ">>>>>>> REPLACE";
        const SEARCH_PREFIX = "<<<<<<<";
        const REPLACE_PREFIX = ">>>>>>>";

        const reportMergeConflictError = (found: string, _expected: string) => ({
            success: false,
            error:
                `ERROR: Special marker '${found}' found in your diff content at line ${state.line}:\n` +
                "\n" +
                `When removing merge conflict markers like '${found}' from files, you MUST escape them\n` +
                "in your SEARCH section by prepending a backslash (\\) at the beginning of the line:\n" +
                "\n" +
                "CORRECT FORMAT:\n\n" +
                "<<<<<<< SEARCH\n" +
                "content before\n" +
                `\\${found}    <-- Note the backslash here in this example\n` +
                "content after\n" +
                "=======\n" +
                "replacement content\n" +
                ">>>>>>> REPLACE\n" +
                "\n" +
                "Without escaping, the system confuses your content with diff syntax markers.\n" +
                "You may use multiple diff blocks in a single diff request, but ANY of ONLY the following separators that occur within SEARCH or REPLACE content must be escaped, as follows:\n" +
                `\\${SEARCH}\n` +
                `\\${SEP}\n` +
                `\\${REPLACE}\n`,
        });

        const reportInvalidDiffError = (found: string, expected: string) => ({
            success: false,
            error:
                `ERROR: Diff block is malformed: marker '${found}' found in your diff content at line ${state.line}. Expected: ${expected}\n` +
                "\n" +
                "CORRECT FORMAT:\n\n" +
                "<<<<<<< SEARCH\n" +
                ":start_line: (required) The line number of original content where the search block starts.\n" +
                "-------\n" +
                "[exact content to find including whitespace]\n" +
                "=======\n" +
                "[new content to replace with]\n" +
                ">>>>>>> REPLACE\n",
        });

        const reportLineMarkerInReplaceError = (marker: string) => ({
            success: false,
            error:
                `ERROR: Invalid line marker '${marker}' found in REPLACE section at line ${state.line}\n` +
                "\n" +
                "Line markers (:start_line: and :end_line:) are only allowed in SEARCH sections.\n" +
                "\n" +
                "CORRECT FORMAT:\n" +
                "<<<<<<< SEARCH\n" +
                ":start_line:5\n" +
                "content to find\n" +
                "=======\n" +
                "replacement content\n" +
                ">>>>>>> REPLACE\n" +
                "\n" +
                "INCORRECT FORMAT:\n" +
                "<<<<<<< SEARCH\n" +
                "content to find\n" +
                "=======\n" +
                ":start_line:5    <-- Invalid location\n" +
                "replacement content\n" +
                ">>>>>>> REPLACE\n",
        });

        const lines = diffContent.split("\n");
        const searchCount = lines.filter((l) => SEARCH_PATTERN.test(l.trim())).length;
        const sepCount = lines.filter((l) => l.trim() === SEP).length;
        const replaceCount = lines.filter((l) => l.trim() === REPLACE).length;

        const likelyBadStructure = searchCount !== replaceCount || sepCount < searchCount;

        for (const line of diffContent.split("\n")) {
            state.line++;
            const marker = line.trim();

            if (state.current === State.AFTER_SEPARATOR) {
                if (marker.startsWith(":start_line:") && !line.trim().startsWith("\\:start_line:")) {
                    return reportLineMarkerInReplaceError(":start_line:");
                }
                if (marker.startsWith(":end_line:") && !line.trim().startsWith("\\:end_line:")) {
                    return reportLineMarkerInReplaceError(":end_line:");
                }
            }

            switch (state.current) {
                case State.START:
                    if (marker === SEP) {
                        return likelyBadStructure
                            ? reportInvalidDiffError(SEP, SEARCH)
                            : reportMergeConflictError(SEP, SEARCH);
                    }
                    if (marker === REPLACE) { return reportInvalidDiffError(REPLACE, SEARCH); }
                    if (marker.startsWith(REPLACE_PREFIX)) { return reportMergeConflictError(marker, SEARCH); }
                    if (SEARCH_PATTERN.test(marker)) { state.current = State.AFTER_SEARCH; }
                    else if (marker.startsWith(SEARCH_PREFIX)) { return reportMergeConflictError(marker, SEARCH); }
                    break;

                case State.AFTER_SEARCH:
                    if (SEARCH_PATTERN.test(marker)) { return reportInvalidDiffError(SEARCH_PATTERN.source, SEP); }
                    if (marker.startsWith(SEARCH_PREFIX)) { return reportMergeConflictError(marker, SEARCH); }
                    if (marker === REPLACE) { return reportInvalidDiffError(REPLACE, SEP); }
                    if (marker.startsWith(REPLACE_PREFIX)) { return reportMergeConflictError(marker, SEARCH); }
                    if (marker === SEP) { state.current = State.AFTER_SEPARATOR; }
                    break;

                case State.AFTER_SEPARATOR:
                    if (SEARCH_PATTERN.test(marker)) { return reportInvalidDiffError(SEARCH_PATTERN.source, REPLACE); }
                    if (marker.startsWith(SEARCH_PREFIX)) { return reportMergeConflictError(marker, REPLACE); }
                    if (marker === SEP) {
                        return likelyBadStructure
                            ? reportInvalidDiffError(SEP, REPLACE)
                            : reportMergeConflictError(SEP, REPLACE);
                    }
                    if (marker === REPLACE) { state.current = State.START; }
                    else if (marker.startsWith(REPLACE_PREFIX)) { return reportMergeConflictError(marker, REPLACE); }
                    break;
            }
        }

        return state.current === State.START
            ? { success: true }
            : {
                success: false,
                error: `ERROR: Unexpected end of sequence: Expected '${state.current === State.AFTER_SEARCH ? "=======" : ">>>>>>> REPLACE"
                    }' was not found.`,
            };
    }

    async applyDiff(
        originalContent: string,
        diffContent: string,
        _paramStartLine?: number,
        _paramEndLine?: number,
    ): Promise<DiffResult> {
        const validseq = this.validateMarkerSequencing(diffContent);
        if (!validseq.success) {
            return {
                success: false,
                error: validseq.error!,
            };
        }

        let matches = [
            ...diffContent.matchAll(
                /(?:^|\n)(?<!\\)<<<<<<< SEARCH>?\s*\n((?:\:start_line:\s*(\d+)\s*\n))?((?:\:end_line:\s*(\d+)\s*\n))?((?<!\\)-------\s*\n)?([\s\S]*?)(?:\n)?(?:(?<=\n)(?<!\\)=======\s*\n)([\s\S]*?)(?:\n)?(?:(?<=\n)(?<!\\)>>>>>>> REPLACE)(?=\n|$)/g,
            ),
        ];

        if (matches.length === 0) {
            return {
                success: false,
                error: `Invalid diff format - missing required sections\n\nDebug Info:\n- Expected Format: <<<<<<< SEARCH\\n:start_line: start line\\n-------\\n[search content]\\n=======\\n[replace content]\\n>>>>>>> REPLACE\n- Tip: Make sure to include start_line/SEARCH/=======/REPLACE sections with correct markers on new lines`,
            };
        }

        const lineEnding = originalContent.includes("\r\n") ? "\r\n" : "\n";
        let resultLines = originalContent.split(/\r?\n/);
        let delta = 0;
        let diffResults: DiffResult[] = [];
        let appliedCount = 0;
        const replacements = matches
            .map((match) => ({
                startLine: Number(match[2] ?? 0),
                searchContent: match[6],
                replaceContent: match[7],
            }))
            .sort((a, b) => a.startLine - b.startLine);

        for (const replacement of replacements) {
            let { searchContent, replaceContent } = replacement;
            let startLine = replacement.startLine + (replacement.startLine === 0 ? 0 : delta);

            searchContent = this.unescapeMarkers(searchContent);
            replaceContent = this.unescapeMarkers(replaceContent);

            const hasAllLineNumbers =
                (everyLineHasLineNumbers(searchContent) && everyLineHasLineNumbers(replaceContent)) ||
                (everyLineHasLineNumbers(searchContent) && replaceContent.trim() === "");

            if (hasAllLineNumbers && startLine === 0) {
                startLine = parseInt(searchContent.split("\n")[0].split("|")[0]);
            }

            if (hasAllLineNumbers) {
                searchContent = stripLineNumbers(searchContent);
                replaceContent = stripLineNumbers(replaceContent);
            }

            if (searchContent === replaceContent) {
                diffResults.push({
                    success: false,
                    error:
                        `Search and replace content are identical - no changes would be made\n\n` +
                        `Debug Info:\n` +
                        `- Search and replace must be different to make changes\n` +
                        `- Use read_file to verify the content you want to change`,
                });
                continue;
            }

            let searchLines = searchContent === "" ? [] : searchContent.split(/\r?\n/);
            let replaceLines = replaceContent === "" ? [] : replaceContent.split(/\r?\n/);

            if (searchLines.length === 0) {
                diffResults.push({
                    success: false,
                    error: `Empty search content is not allowed\n\nDebug Info:\n- Search content cannot be empty\n- For insertions, provide a specific line using :start_line: and include content to search for\n- For example, match a single line to insert before/after it`,
                });
                continue;
            }

            let endLine = replacement.startLine + searchLines.length - 1;

            let matchIndex = -1;
            let bestMatchScore = 0;
            let bestMatchContent = "";
            let searchChunk = searchLines.join("\n");

            let searchStartIndex = 0;
            let searchEndIndex = resultLines.length;

            if (startLine) {
                const exactStartIndex = startLine - 1;
                const searchLen = searchLines.length;
                const exactEndIndex = exactStartIndex + searchLen - 1;

                const originalChunk = resultLines.slice(exactStartIndex, exactEndIndex + 1).join("\n");
                const similarity = getSimilarity(originalChunk, searchChunk);
                if (similarity >= this.fuzzyThreshold) {
                    matchIndex = exactStartIndex;
                    bestMatchScore = similarity;
                    bestMatchContent = originalChunk;
                } else {
                    searchStartIndex = Math.max(0, startLine - (this.bufferLines + 1));
                    searchEndIndex = Math.min(resultLines.length, startLine + searchLines.length + this.bufferLines);
                }
            }

            if (matchIndex === -1) {
                const {
                    bestScore,
                    bestMatchIndex,
                    bestMatchContent: midContent,
                } = fuzzySearch(resultLines, searchChunk, searchStartIndex, searchEndIndex);
                matchIndex = bestMatchIndex;
                bestMatchScore = bestScore;
                bestMatchContent = midContent;
            }

            if (matchIndex === -1 || bestMatchScore < this.fuzzyThreshold) {
                const aggressiveSearchContent = stripLineNumbers(searchContent, true);
                const aggressiveReplaceContent = stripLineNumbers(replaceContent, true);

                const aggressiveSearchLines = aggressiveSearchContent ? aggressiveSearchContent.split(/\r?\n/) : [];
                const aggressiveSearchChunk = aggressiveSearchLines.join("\n");

                const {
                    bestScore,
                    bestMatchIndex,
                    bestMatchContent: aggContent,
                } = fuzzySearch(resultLines, aggressiveSearchChunk, searchStartIndex, searchEndIndex);
                if (bestMatchIndex !== -1 && bestScore >= this.fuzzyThreshold) {
                    matchIndex = bestMatchIndex;
                    bestMatchScore = bestScore;
                    bestMatchContent = aggContent;
                    searchContent = aggressiveSearchContent;
                    replaceContent = aggressiveReplaceContent;
                    searchLines = aggressiveSearchLines;
                    replaceLines = replaceContent ? replaceContent.split(/\r?\n/) : [];
                } else {
                    const originalContentSection =
                        startLine !== undefined && endLine !== undefined
                            ? `\n\nOriginal Content:\n${addLineNumbers(
                                resultLines
                                    .slice(
                                        Math.max(0, startLine - 1 - this.bufferLines),
                                        Math.min(resultLines.length, endLine + this.bufferLines),
                                    )
                                    .join("\n"),
                                Math.max(1, startLine - this.bufferLines),
                            )}`
                            : `\n\nOriginal Content:\n${addLineNumbers(resultLines.join("\n"))}`;

                    const bestMatchSection = bestMatchContent
                        ? `\n\nBest Match Found:\n${addLineNumbers(bestMatchContent, matchIndex + 1)}`
                        : `\n\nBest Match Found:\n(no match)`;

                    const lineRange = startLine ? ` at line: ${startLine}` : "";

                    diffResults.push({
                        success: false,
                        error: `No sufficiently similar match found${lineRange} (${Math.floor(bestMatchScore * 100)}% similar, needs ${Math.floor(this.fuzzyThreshold * 100)}%)\n\nDebug Info:\n- Similarity Score: ${Math.floor(bestMatchScore * 100)}%\n- Required Threshold: ${Math.floor(this.fuzzyThreshold * 100)}%\n- Search Range: ${startLine ? `starting at line ${startLine}` : "start to end"}\n- Tried both standard and aggressive line number stripping\n- Tip: Use the read_file tool to get the latest content of the file before attempting to use the apply_diff tool again, as the file content may have changed\n\nSearch Content:\n${searchChunk}${bestMatchSection}${originalContentSection}`,
                    });
                    continue;
                }
            }

            const matchedLines = resultLines.slice(matchIndex, matchIndex + searchLines.length);

            const originalIndents = matchedLines.map((line) => {
                const match = line.match(/^[\t ]*/);
                return match ? match[0] : "";
            });

            const searchIndents = searchLines.map((line) => {
                const match = line.match(/^[\t ]*/);
                return match ? match[0] : "";
            });

            const indentedReplaceLines = replaceLines.map((line) => {
                const matchedIndent = originalIndents[0] || "";
                const currentIndentMatch = line.match(/^[\t ]*/);
                const currentIndent = currentIndentMatch ? currentIndentMatch[0] : "";
                const searchBaseIndent = searchIndents[0] || "";

                const searchBaseLevel = searchBaseIndent.length;
                const currentLevel = currentIndent.length;
                const relativeLevel = currentLevel - searchBaseLevel;

                const finalIndent =
                    relativeLevel < 0
                        ? matchedIndent.slice(0, Math.max(0, matchedIndent.length + relativeLevel))
                        : matchedIndent + currentIndent.slice(searchBaseLevel);

                return finalIndent + line.trim();
            });

            const beforeMatch = resultLines.slice(0, matchIndex);
            const afterMatch = resultLines.slice(matchIndex + searchLines.length);
            resultLines = [...beforeMatch, ...indentedReplaceLines, ...afterMatch];
            delta = delta - matchedLines.length + replaceLines.length;
            appliedCount++;
        }
        const finalContent = resultLines.join(lineEnding);
        if (appliedCount === 0) {
            return {
                success: false,
                failParts: diffResults,
            };
        }
        return {
            success: true,
            content: finalContent,
            failParts: diffResults,
        };
    }
}

// ApplyDiffTool
// ==========================================

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

        // Unescape HTML entities if needed (assuming similar behavior to Roo-Code)
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

            // Capture pre-diagnostics BEFORE applying diff (Roo Code approach)
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

            // Detect new problems after the edit (Roo Code approach)
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
