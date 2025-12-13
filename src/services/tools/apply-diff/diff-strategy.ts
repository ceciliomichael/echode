/**
 * Multi-search-replace diff strategy implementation
 */

import { DiffResult, DiffStrategy } from './types';
import { validateMarkerSequencing } from './diff-validator';
import { addLineNumbers, everyLineHasLineNumbers, stripLineNumbers } from './line-number-utils';
import { fuzzySearch, getSimilarity, BUFFER_LINES } from './fuzzy-search';

/**
 * Diff strategy that supports multiple search/replace blocks with fuzzy matching
 */
export class MultiSearchReplaceDiffStrategy implements DiffStrategy {
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

        const lineEnding = originalContent.includes("\r\n") ? "\r\n" : "\n";
        let resultLines = originalContent.split(/\r?\n/);
        let delta = 0;
        const diffResults: DiffResult[] = [];
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

            const endLine = replacement.startLine + searchLines.length - 1;

            let matchIndex = -1;
            let bestMatchScore = 0;
            let bestMatchContent = "";
            const searchChunk = searchLines.join("\n");

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