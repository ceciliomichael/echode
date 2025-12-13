/**
 * Fuzzy search utilities for diff matching
 */

import { distance } from 'fastest-levenshtein';
import { FuzzySearchResult } from './types';
import { normalizeString } from './string-normalization';

/**
 * Default buffer lines for fuzzy search range
 */
export const BUFFER_LINES = 40;

/**
 * Calculate similarity between two strings using Levenshtein distance
 * @param original - The original string
 * @param search - The search string to compare
 * @returns Similarity score between 0 and 1
 */
export function getSimilarity(original: string, search: string): number {
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

/**
 * Perform fuzzy search to find best matching content in lines
 * Uses bidirectional search from midpoint for efficiency
 * @param lines - Array of lines to search in
 * @param searchChunk - The content to search for
 * @param startIndex - Start index for search range
 * @param endIndex - End index for search range
 * @returns Best match result with score, index, and content
 */
export function fuzzySearch(
    lines: string[],
    searchChunk: string,
    startIndex: number,
    endIndex: number
): FuzzySearchResult {
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