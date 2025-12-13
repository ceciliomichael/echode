/**
 * Ripgrep JSON output parsing
 *
 * This module extracts the common parsing logic that was previously
 * duplicated in regexSearchFiles and regexSearchFilesStructured.
 */

import { SearchFileResult } from './types';
import { truncateLine } from './text-utils';

/**
 * Parse ripgrep JSON output into structured results
 * 
 * @param output - Raw JSON output from ripgrep
 * @returns Array of SearchFileResult with parsed matches and context
 */
export function parseRipgrepJsonOutput(output: string): SearchFileResult[] {
    const results: SearchFileResult[] = [];
    let currentFile: SearchFileResult | null = null;

    output.split('\n').forEach((line) => {
        if (line) {
            try {
                const parsed = JSON.parse(line);
                if (parsed.type === 'begin') {
                    currentFile = {
                        file: parsed.data.path.text.toString(),
                        searchResults: [],
                    };
                } else if (parsed.type === 'end') {
                    if (currentFile) {
                        results.push(currentFile);
                        currentFile = null;
                    }
                } else if ((parsed.type === 'match' || parsed.type === 'context') && currentFile) {
                    const lineData = {
                        line: parsed.data.line_number,
                        text: truncateLine(parsed.data.lines.text),
                        isMatch: parsed.type === 'match',
                        ...(parsed.type === 'match' && { column: parsed.data.absolute_offset }),
                    };

                    const lastResult = currentFile.searchResults[currentFile.searchResults.length - 1];
                    if (lastResult?.lines.length > 0) {
                        const lastLine = lastResult.lines[lastResult.lines.length - 1];

                        // If this line is contiguous with the last result, add to it
                        if (parsed.data.line_number <= lastLine.line + 1) {
                            lastResult.lines.push(lineData);
                        } else {
                            // Otherwise create a new result
                            currentFile.searchResults.push({
                                lines: [lineData],
                            });
                        }
                    } else {
                        // First line in file
                        currentFile.searchResults.push({
                            lines: [lineData],
                        });
                    }
                }
            } catch (error) {
                console.error('[GREP] Error parsing ripgrep output line:', error);
            }
        }
    });

    return results;
}