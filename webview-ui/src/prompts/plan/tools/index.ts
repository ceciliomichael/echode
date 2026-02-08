/**
 * Plan Mode - Tool Instructions
 * Uses shared tool factories with XML format
 * NOTE: NO editing tools (edit, write_to_file, delete) exist in Plan mode
 */

import type { Tool } from '../../../types/tool';
import {
    getReadFileInstructions,
    getGrepSearchInstructions,
    getGlobSearchInstructions,
    getListFilesInstructions,
    getTodoWriteInstructions,
    getPlanInstructions,
} from '../../shared/tools';

const TOOL_INSTRUCTION_MAP: Record<string, () => string> = {
    'read_file': () => getReadFileInstructions({ format: 'xml' }),
    'grep_search': () => getGrepSearchInstructions({ format: 'xml' }),
    'glob_search': () => getGlobSearchInstructions({ format: 'xml' }),
    'list_files': () => getListFilesInstructions({ format: 'xml' }),
    'todo_write': () => getTodoWriteInstructions({ format: 'xml' }),
    'plan': getPlanInstructions,
};

/**
 * Get tool instructions for Plan mode based on enabled tools
 */
export function getPlanToolInstructions(enabledTools: Tool[]): string {
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