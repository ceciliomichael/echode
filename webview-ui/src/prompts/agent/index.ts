/**
 * Agent Mode - Main prompt builder
 * Assembles the complete Agent mode system prompt
 */

import type { WorkspaceContext } from '../../types/workspace';
import type { Tool } from '../../types/tool';
import { getUserRules, getSystemInfo } from '../shared';
import { getAgentModeSection } from './mode-section';
import { getAgentRules } from './rules';
import { getAgentCognitiveWorkflow } from './cognitive-workflow';
import { getAgentToolChains } from './tool-chains';
import { getAgentToolInstructions } from './tools';
import { getToolSystemPrompt } from '../../lib/tool-config';

export interface AgentPromptOptions {
    workspace: WorkspaceContext | null;
    enabledTools: Tool[];
}

/**
 * Build the complete Agent mode system prompt
 */
export function buildAgentPrompt(options: AgentPromptOptions): string {
    const { workspace, enabledTools } = options;

    const cognitiveWorkflow = getAgentCognitiveWorkflow();

    // Tool format section (generic XML format)
    const toolsSection = enabledTools.length > 0
        ? getToolSystemPrompt(enabledTools)
        : `<tool_status>
No tools are currently enabled.
</tool_status>`;

    // Mode-specific tool instructions
    const toolInstructions = getAgentToolInstructions(enabledTools);

    const toolChains = getAgentToolChains(enabledTools);
    const rules = getAgentRules(workspace, enabledTools);
    const modeSection = getAgentModeSection();
    const userRules = getUserRules(workspace);
    const systemInfo = getSystemInfo(workspace);

    // Assemble in priority order
    const sections = [
        cognitiveWorkflow,
        toolsSection,
        toolInstructions,
        toolChains,
        rules,
        modeSection,
        userRules,
        systemInfo,
    ].filter(Boolean);

    return sections.join('\n\n').trim();
}

// Re-export components
export { getAgentModeSection } from './mode-section';
export { getAgentRules } from './rules';
export { getAgentCognitiveWorkflow } from './cognitive-workflow';
export { getAgentToolChains } from './tool-chains';
export { getAgentToolInstructions } from './tools';
export { getAgentSystemReminder, getAgentTodoReminder } from './reminders';
