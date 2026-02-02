/**
 * Ask Mode - Tool Instructions
 * Uses shared tool factories with XML format for Q&A mode (read-only exploration)
 */

import type { Tool } from '../../../types/tool';
import {
    getReadFileInstructions,
    getGrepSearchInstructions,
    getGlobSearchInstructions,
    getListFilesInstructions,
} from '../../shared/tools';

const TOOL_INSTRUCTION_MAP: Record<string, () => string> = {
    'read_file': () => getReadFileInstructions({ format: 'xml' }),
    'grep_search': () => getGrepSearchInstructions({ format: 'xml' }),
    'glob_search': () => getGlobSearchInstructions({ format: 'xml' }),
    'list_files': () => getListFilesInstructions({ format: 'xml' }),
};

/**
 * Get tool instructions for Ask mode based on enabled tools
 */
export function getAskToolInstructions(enabledTools: Tool[]): string {
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