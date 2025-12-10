/**
 * Ask Mode - Tool Instructions
 * Exports mode-specific instructions for Q&A mode (read-only exploration)
 */

import type { Tool } from '../../../types/tool';

// Import individual tool instructions
import { getReadFileInstructions } from './read-file';
import { getEchoSearchInstructions } from './echo-search';
import { getGrepSearchInstructions } from './grep-search';
import { getGlobSearchInstructions } from './glob-search';
import { getListFilesInstructions } from './list-files';

const TOOL_INSTRUCTION_MAP: Record<string, () => string> = {
    'read_file': getReadFileInstructions,
    'echo_search': getEchoSearchInstructions,
    'grep_search': getGrepSearchInstructions,
    'glob_search': getGlobSearchInstructions,
    'list_files': getListFilesInstructions,
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

    if (instructions.length === 0) return '';

    return `<tool_instructions>
${instructions.join('\n\n')}
</tool_instructions>`;
}
