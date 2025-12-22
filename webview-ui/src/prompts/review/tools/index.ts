/**
 * Review Mode - Tool Instructions
 * Aggregates mode-specific instructions for code review tools
 */

import type { Tool } from '../../../types/tool';

// Import individual tool instructions
import { getReadFileInstructions } from './read-file';
import { getListFilesInstructions } from './list-files';
import { getGrepSearchInstructions } from './grep-search';
import { getGlobSearchInstructions } from './glob-search';
import { getEchoSearchInstructions } from './echo-search';
import { getGetDiagnosticsInstructions } from './get-diagnostics';
import { getPublishFindingsInstructions } from './publish-findings';

const TOOL_INSTRUCTION_MAP: Record<string, () => string> = {
    'read_file': getReadFileInstructions,
    'list_files': getListFilesInstructions,
    'grep_search': getGrepSearchInstructions,
    'glob_search': getGlobSearchInstructions,
    'echo_search': getEchoSearchInstructions,
    'get_diagnostics': getGetDiagnosticsInstructions,
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