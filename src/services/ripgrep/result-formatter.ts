/**
 * Ripgrep result formatting utilities
 */

import * as path from 'path';
import { SearchFileResult, GrepMatch, GrepFileResult } from './types';
import { MAX_RESULTS } from './constants';

// Re-export truncateLine from text-utils for backward compatibility
export { truncateLine } from './text-utils';

/**
 * Format search results into a readable string
 */
export function formatResults(fileResults: SearchFileResult[], cwd: string): string {
    const groupedResults: { [key: string]: SearchFileResult['searchResults'] } = {};

    const totalResults = fileResults.reduce((sum, file) => sum + file.searchResults.length, 0);
    let output = '';

    if (totalResults >= MAX_RESULTS) {
        output += `Showing first ${MAX_RESULTS} of ${MAX_RESULTS}+ results. Use a more specific search if necessary.\n\n`;
    } else {
        output += `Found ${totalResults === 1 ? '1 result' : `${totalResults.toLocaleString()} results`}.\n\n`;
    }

    // Group results by file name
    fileResults.slice(0, MAX_RESULTS).forEach((file) => {
        const relativeFilePath = path.relative(cwd, file.file);
        if (!groupedResults[relativeFilePath]) {
            groupedResults[relativeFilePath] = [];
            groupedResults[relativeFilePath].push(...file.searchResults);
        }
    });

    for (const [filePath, results] of Object.entries(groupedResults)) {
        // Convert backslashes to forward slashes for consistent display
        output += `# ${filePath.replace(/\\/g, '/')}\n`;

        results.forEach((result) => {
            if (result.lines.length > 0) {
                result.lines.forEach((line) => {
                    const lineNumber = String(line.line).padStart(3, ' ');
                    output += `${lineNumber} | ${line.text.trimEnd()}\n`;
                });
                output += '----\n';
            }
        });

        output += '\n';
    }

    return output.trim();
}

/**
 * Convert internal SearchFileResult to structured GrepFileResult for frontend
 */
export function toStructuredResults(fileResults: SearchFileResult[], cwd: string, query: string): GrepFileResult[] {
    return fileResults.map((file) => {
        const relativeFilePath = path.relative(cwd, file.file).replace(/\\/g, '/');
        const matches: GrepMatch[] = [];

        file.searchResults.forEach((result) => {
            result.lines.forEach((line) => {
                if (line.isMatch) {
                    matches.push({
                        line: line.line,
                        column: line.column || 0,
                        text: line.text.trimEnd(),
                        matchText: query,
                    });
                }
            });
        });

        return {
            file: relativeFilePath,
            matches,
        };
    }).filter(file => file.matches.length > 0);
}