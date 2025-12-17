/**
 * Diff validation utilities for marker sequencing
 */

import { ValidationResult } from './types';

/**
 * State machine states for marker validation
 */
enum ValidatorState {
    START,
    AFTER_SEARCH,
    AFTER_SEPARATOR,
}

/**
 * Marker constants for diff syntax
 */
const SEARCH_PATTERN = /^<<<<<<< SEARCH>?$/;
const SEARCH = SEARCH_PATTERN.source.replace(/[\^$]/g, "");
const SEP = "=======";
const REPLACE = ">>>>>>> REPLACE";
const SEARCH_PREFIX = "<<<<<<<";
const REPLACE_PREFIX = ">>>>>>>";

/**
 * Build error message for merge conflict markers found in diff content
 */
function buildMergeConflictError(found: string, lineNumber: number): ValidationResult {
    return {
        success: false,
        error:
            `ERROR: Special marker '${found}' found in your diff content at line ${lineNumber}:\n` +
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
    };
}

/**
 * Build error message for malformed diff block structure
 */
function buildInvalidDiffError(found: string, expected: string, lineNumber: number): ValidationResult {
    return {
        success: false,
        error:
            `ERROR: Diff block is malformed: marker '${found}' found in your diff content at line ${lineNumber}. Expected: ${expected}\n` +
            "\n" +
            "CORRECT FORMAT:\n\n" +
            "<<<<<<< SEARCH\n" +
            ":start_line: (required) The line number of original content where the search block starts.\n" +
            "-------\n" +
            "[exact content to find including whitespace]\n" +
            "=======\n" +
            "[new content to replace with]\n" +
            ">>>>>>> REPLACE\n",
    };
}

/**
 * Build error message for line markers found in REPLACE section
 */
function buildLineMarkerInReplaceError(marker: string, lineNumber: number): ValidationResult {
    return {
        success: false,
        error:
            `ERROR: Invalid line marker '${marker}' found in REPLACE section at line ${lineNumber}\n` +
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
    };
}

/**
 * Validate marker sequencing in diff content
 * Ensures proper order: <<<<<<< SEARCH -> ======= -> >>>>>>> REPLACE
 * @param diffContent - The diff content to validate
 * @returns Validation result with success status and optional error
 */
export function validateMarkerSequencing(diffContent: string): ValidationResult {
    const state = { current: ValidatorState.START, line: 0 };

    const lines = diffContent.split("\n");
    const searchCount = lines.filter((l) => SEARCH_PATTERN.test(l.trim())).length;
    const sepCount = lines.filter((l) => l.trim() === SEP).length;
    const replaceCount = lines.filter((l) => l.trim() === REPLACE).length;

    const likelyBadStructure = searchCount !== replaceCount || sepCount < searchCount;

    for (const line of diffContent.split("\n")) {
        state.line++;
        const marker = line.trim();

        // Check for line markers in REPLACE section
        if (state.current === ValidatorState.AFTER_SEPARATOR) {
            if (marker.startsWith(":start_line:") && !line.trim().startsWith("\\:start_line:")) {
                return buildLineMarkerInReplaceError(":start_line:", state.line);
            }
            if (marker.startsWith(":end_line:") && !line.trim().startsWith("\\:end_line:")) {
                return buildLineMarkerInReplaceError(":end_line:", state.line);
            }
        }

        switch (state.current) {
            case ValidatorState.START:
                if (marker === SEP) {
                    return likelyBadStructure
                        ? buildInvalidDiffError(SEP, SEARCH, state.line)
                        : buildMergeConflictError(SEP, state.line);
                }
                if (marker === REPLACE) {
                    return buildInvalidDiffError(REPLACE, SEARCH, state.line);
                }
                if (marker.startsWith(REPLACE_PREFIX)) {
                    return buildMergeConflictError(marker, state.line);
                }
                if (SEARCH_PATTERN.test(marker)) {
                    state.current = ValidatorState.AFTER_SEARCH;
                } else if (marker.startsWith(SEARCH_PREFIX)) {
                    return buildMergeConflictError(marker, state.line);
                }
                break;

            case ValidatorState.AFTER_SEARCH:
                if (SEARCH_PATTERN.test(marker)) {
                    return buildInvalidDiffError(SEARCH_PATTERN.source, SEP, state.line);
                }
                if (marker.startsWith(SEARCH_PREFIX)) {
                    return buildMergeConflictError(marker, state.line);
                }
                if (marker === REPLACE) {
                    return buildInvalidDiffError(REPLACE, SEP, state.line);
                }
                if (marker.startsWith(REPLACE_PREFIX)) {
                    return buildMergeConflictError(marker, state.line);
                }
                if (marker === SEP) {
                    state.current = ValidatorState.AFTER_SEPARATOR;
                }
                break;

            case ValidatorState.AFTER_SEPARATOR:
                if (SEARCH_PATTERN.test(marker)) {
                    return buildInvalidDiffError(SEARCH_PATTERN.source, REPLACE, state.line);
                }
                if (marker.startsWith(SEARCH_PREFIX)) {
                    return buildMergeConflictError(marker, state.line);
                }
                if (marker === SEP) {
                    return likelyBadStructure
                        ? buildInvalidDiffError(SEP, REPLACE, state.line)
                        : buildMergeConflictError(SEP, state.line);
                }
                if (marker === REPLACE) {
                    state.current = ValidatorState.START;
                } else if (marker.startsWith(REPLACE_PREFIX)) {
                    return buildMergeConflictError(marker, state.line);
                }
                break;
        }
    }

    return state.current === ValidatorState.START
        ? { success: true }
        : {
            success: false,
            error: `ERROR: Unexpected end of sequence: Expected '${state.current === ValidatorState.AFTER_SEARCH ? "=======" : ">>>>>>> REPLACE"
                }' was not found.`,
        };
}