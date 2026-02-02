/**
 * Review Mode - Tool Instructions
 * Uses shared tool factories with review-specific variants
 */

import type { Tool } from '../../../types/tool';
import {
    getReadFileInstructions,
    getGrepSearchInstructions,
    getGlobSearchInstructions,
    getListFilesInstructions,
    getGetDiagnosticsInstructions,
    getPublishFindingsInstructions,
} from '../../shared/tools';

const TOOL_INSTRUCTION_MAP: Record<string, () => string> = {
    'read_file': () => getReadFileInstructions({ variant: 'review' }),
    'grep_search': () => getGrepSearchInstructions(),
    'glob_search': () => getGlobSearchInstructions(),
    'list_files': () => getListFilesInstructions(),
    'get_diagnostics': () => getGetDiagnosticsInstructions(),
    'publish_findings': getPublishFindingsInstructions,
};

/**
 * Get tool instructions for Review mode based on enabled tools
 */
export function getReviewToolInstructions(enabledTools: Tool[]): string {
    const instructions = enabledTools
        .map(tool => {
            const getInstructions = TOOL_INSTRUCTION_MAP[tool.id];
            return getInstructions ? getInstructions() : '';
        })
        .filter(Boolean);

    if (instructions.length === 0) {return '';}

    return `<tool_instructions>
${instructions.join('\n\n')}
</tool_instructions>`;
}