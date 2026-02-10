/**
 * Agent Mode - Main Prompt
 * Assembles modular sections: identity, workflow, rules
 */

import type { WorkspaceContext } from '../../types/workspace';
import type { Tool } from '../../types/tool';
import { IMAGE_AWARENESS_RULES, INTERACTION_RULES, MERMAID_DIAGRAM_RULES } from '../shared';
import { getAgentIdentity, AGENT_WORKFLOW, getAgentRules, SUB_AGENT_RULES } from './sections';

/** Tools available in Agent mode (ordered by frequency of use) */
const AGENT_TOOLS = [
    'read_file', 'edit', 'write_to_file', 'delete',
    'grep_search', 'glob_search', 'list_files',
    'get_diagnostics', 'todo_write',
    'run_terminal',
    'create_subagent', 'use_subagent'
] as const;

export function getAgentPrompt(
    workspace: WorkspaceContext | null,
    enabledTools: Tool[] = [],
    modeName: string = 'AGENT'
): string {
    const cwd = workspace?.path || 'the current workspace directory';
    const enabledIds = new Set(enabledTools.map(t => t.id));
    const subAgentsEnabled = enabledIds.has('create_subagent') || enabledIds.has('use_subagent');

    // Filter to only enabled tools
    const toolList = AGENT_TOOLS.filter(tool => enabledIds.has(tool));

    return `<agent>
${getAgentIdentity(modeName, [...toolList], cwd)}

${INTERACTION_RULES}

${MERMAID_DIAGRAM_RULES}

${AGENT_WORKFLOW}

${getAgentRules()}

${subAgentsEnabled ? SUB_AGENT_RULES : ''}

${IMAGE_AWARENESS_RULES}
</agent>`;
}