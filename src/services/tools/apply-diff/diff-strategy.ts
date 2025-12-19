/**
 * Search-replace diff strategy implementation
 */

import { DiffResult, DiffStrategy } from './types';
import { validateMarkerSequencing } from './diff-validator';
import { addLineNumbers, everyLineHasLineNumbers, stripLineNumbers } from './line-number-utils';
import { fuzzySearch, getSimilarity, BUFFER_LINES } from './fuzzy-search';

/**
 * Diff strategy that supports a single search/replace block with fuzzy matching
 */
export class SearchReplaceDiffStrategy implements DiffStrategy {
    private fuzzyThreshold: number;
    private bufferLines: number;

    constructor(fuzzyThreshold?: number, bufferLines?: number) {
        this.fuzzyThreshold = fuzzyThreshold ?? 1.0;
        this.bufferLines = bufferLines ?? BUFFER_LINES;
    }

    /**
     * Unescape markers that were escaped in the diff content
     */
    private unescapeMarkers(content: string): string {
        return content
            .replace(/^\\<<<<<<</gm, "<<<<<<<")
            .replace(/^\\=======/gm, "=======")
            .replace(/^\\>>>>>>>/gm, ">>>>>>>")
            .replace(/^\\-------/gm, "-------")
            .replace(/^\\:end_line:/gm, ":end_line:")
            .replace(/^\\:start_line:/gm, ":start_line:");
    }

    /**
     * Apply diff to original content
     * @param originalContent - The original file content
     * @param diffContent - The diff content with search/replace blocks
     * @param _paramStartLine - Optional start line parameter (unused)
     * @param _paramEndLine - Optional end line parameter (unused)
     * @returns Result of the diff application
     */
    async applyDiff(
        originalContent: string,
        diffContent: string,
        _paramStartLine?: number,
        _paramEndLine?: number,
    ): Promise<DiffResult> {
        const validseq = validateMarkerSequencing(diffContent);
        if (!validseq.success) {
            return {
                success: false,
                error: validseq.error!,
            };
        }

        const matches = [
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

        if (matches.length > 1) {
            return {
                success: false,
                error: `Multiple search/replace blocks are not allowed. Please use separate tool invocations for each edit.`,
            };
        }

        const match = matches[0];
        const startLineParam = Number(match[2] ?? 0);
        let searchContent = match[6];
        let replaceContent = match[7];

        const lineEnding = originalContent.includes("\r\n") ? "\r\n" : "\n";
        let resultLines = originalContent.split(/\r?\n/);

        let startLine = startLineParam;

        // Note: We don't use unescapeMarkers exactly as implemented in original because it had side effects or specific logic? 
        // Original logic:
        /*
        private unescapeMarkers(content: string): string {
            return content
                .replace(/^\\<<<<<<</gm, "<<<<<<<")
                .replace(/^\\=======/gm, "=======")
                .replace(/^\\>>>>>>>/gm, ">>>>>>>")
                .replace(/^\\-------/gm, "-------")
                .replace(/^\\:end_line:/gm, ":end_line:")
                .replace(/^\\:start_line:/gm, ":start_line:");
        }
        */
        // I used < etc in my thought which was wrong. Reverting to original implementation logic
        // But wait, I need to implement unescapeMarkers correctly inside the class or use the one I defined.
        
        searchContent = searchContent
            .replace(/^\\<<<<<<</gm, "<<<<<<<")
            .replace(/^\\=======/gm, "=======")
            .replace(/^\\>>>>>>>/gm, ">>>>>>>")
            .replace(/^\\-------/gm, "-------")
            .replace(/^\\:end_line:/gm, ":end_line:")
            .replace(/^\\:start_line:/gm, ":start_line:");

        replaceContent = replaceContent
            .replace(/^\\<<<<<<</gm, "<<<<<<<")
            .replace(/^\\=======/gm, "=======")
            .replace(/^\\>>>>>>>/gm, ">>>>>>>")
            .replace(/^\\-------/gm, "-------")
            .replace(/^\\:end_line:/gm, ":end_line:")
            .replace(/^\\:start_line:/gm, ":start_line:");

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
            return {
                success: false,
                error:
                    `Search and replace content are identical - no changes would be made\n\n` +
                    `Debug Info:\n` +
                    `- Search and replace must be different to make changes\n` +
                    `- Use read_file to verify the content you want to change`,
            };
        }

        let searchLines = searchContent === "" ? [] : searchContent.split(/\r?\n/);
        let replaceLines = replaceContent === "" ? [] : replaceContent.split(/\r?\n/);

        if (searchLines.length === 0) {
            return {
                success: false,
                error: `Empty search content is not allowed\n\nDebug Info:\n- Search content cannot be empty\n- For insertions, provide a specific line using :start_line: and include content to search for\n- For example, match a single line to insert before/after it`,
            };
        }

        let matchIndex = -1;
        let bestMatchScore = 0;
        let bestMatchContent = "";
        const searchChunk = searchLines.join("\n");

        let searchStartIndex = 0;
        let searchEndIndex = resultLines.length;

        if (startLine) {
            const exactStartIndex = startLine - 1;
            const searchLen = searchLines.length;
            
            // Check bounds for exact match attempt
            if (exactStartIndex >= 0 && exactStartIndex < resultLines.length) {
                const exactEndIndex = Math.min(exactStartIndex + searchLen, resultLines.length);
                const originalChunk = resultLines.slice(exactStartIndex, exactEndIndex).join("\n");
                
                const similarity = getSimilarity(originalChunk, searchChunk);
                if (similarity >= this.fuzzyThreshold) {
                    matchIndex = exactStartIndex;
                    bestMatchScore = similarity;
                    bestMatchContent = originalChunk;
                }
            }
            
            if (matchIndex === -1) {
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
            return {
                success: false,
                error: `Could not find a matching code block${
                    startLine ? ` near line ${startLine}` : ""
                } (similarity: ${(bestMatchScore * 100).toFixed(1)}%).\n\nDebug Info:\n- Make sure the SEARCH block contains the exact lines from the file\n- If using line numbers, verify they are correct\n- Try increasing the amount of context lines`,
                details: {
                    similarity: bestMatchScore,
                    expected: searchChunk,
                    found: bestMatchContent,
                },
            };
        }

        // Apply change
        resultLines.splice(matchIndex, searchLines.length, ...replaceLines);

        return {
            success: true,
            content: resultLines.join(lineEnding),
        };
    }
}