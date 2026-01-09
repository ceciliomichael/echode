/**
 * Agent Mode - Main Prompt
 * Assembles modular sections: identity, workflow, rules
 */

import type { WorkspaceContext } from '../../types/workspace';
import type { Tool } from '../../types/tool';
import { IMAGE_AWARENESS_RULES, INTERACTION_RULES } from '../shared';
import { getAgentIdentity, AGENT_WORKFLOW, getAgentRules } from './sections';

/** Tools available in Agent mode (ordered by frequency of use) */
const AGENT_TOOLS = [
    'read_file', 'apply_diff', 'write_to_file', 'delete_file',
    'echo_search', 'grep_search', 'glob_search', 'list_files',
    'get_diagnostics', 'todo_write'
] as const;

export function getAgentPrompt(
    workspace: WorkspaceContext | null,
    enabledTools: Tool[] = [],
    modeName: string = 'AGENT'
): string {
    const cwd = workspace?.path || 'the current workspace directory';
    const enabledIds = new Set(enabledTools.map(t => t.id));

    // Filter to only enabled tools
    const toolList = AGENT_TOOLS.filter(tool => enabledIds.has(tool));

    return `<agent>
${getAgentIdentity(modeName, [...toolList], cwd)}

${INTERACTION_RULES}

${AGENT_WORKFLOW}

${getAgentRules()}

${IMAGE_AWARENESS_RULES}
</agent>`;
}