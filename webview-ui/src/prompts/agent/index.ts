/**
 * Agent Mode - Main prompt builder
 * Assembles the complete Agent mode system prompt
 */

import type { WorkspaceContext } from '../../types/workspace';
import type { Tool } from '../../types/tool';
import { getIdentity, getFocusInstruction, getUserRules, getSystemInfo } from '../shared';
import { getAgentModeSection } from './mode-section';
import { getAgentRules } from './rules';
import { getAgentCognitiveWorkflow } from './cognitive-workflow';
import { getAgentToolChains } from './tool-chains';
import { getToolSystemPrompt } from '../../lib/tool-config';

export interface AgentPromptOptions {
    workspace: WorkspaceContext | null;
    enabledTools: Tool[];
    name?: string;
    purpose?: string;
}

/**
 * Build the complete Agent mode system prompt
 */
export function buildAgentPrompt(options: AgentPromptOptions): string {
    const { workspace, enabledTools, name, purpose } = options;

    const identity = getIdentity('agent', { name, purpose });
    const focus = getFocusInstruction();
    const cognitiveWorkflow = getAgentCognitiveWorkflow();

    // Tool-related sections
    const toolsSection = enabledTools.length > 0
        ? getToolSystemPrompt(enabledTools)
        : `<tool_status>
No tools are currently enabled. You cannot use any tools for this request. All responses must be provided without using any tools.
</tool_status>`;

    const toolChains = getAgentToolChains(enabledTools);
    const rules = getAgentRules(workspace, enabledTools);
    const modeSection = getAgentModeSection();
    const userRules = getUserRules(workspace);
    const systemInfo = getSystemInfo(workspace);

    // Assemble in priority order
    const sections = [
        identity,
        focus,
        cognitiveWorkflow,
        toolsSection,
        toolChains,
        rules,
        modeSection,
        userRules,
        systemInfo,
    ].filter(Boolean);

    return sections.join('\n\n').trim();
}

// Re-export components for direct access if needed
export { getAgentModeSection } from './mode-section';
export { getAgentRules } from './rules';
export { getAgentCognitiveWorkflow } from './cognitive-workflow';
export { getAgentToolChains } from './tool-chains';
export { getAgentSystemReminder, getAgentTodoReminder } from './reminders';
