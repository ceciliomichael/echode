/**
 * Agent Mode - Main prompt builder
 * Assembles the complete Agent mode system prompt
 */

import type { WorkspaceContext } from '../../types/workspace';
import type { Tool } from '../../types/tool';
import { getUserRules, getSystemInfo, getThinkingProcess } from '../shared';
import { getAgentPrompt } from './prompt';
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

    // Tool format section (generic XML format)
    const toolsSection = enabledTools.length > 0
        ? getToolSystemPrompt(enabledTools)
        : `<tool_status>
No tools are currently enabled.
</tool_status>`;

    // Mode-specific tool instructions
    const toolInstructions = getAgentToolInstructions(enabledTools);

    // Monolithic prompt (cognitive workflow + rules + mode description)
    const prompt = getAgentPrompt(workspace, enabledTools);

    const userRules = getUserRules(workspace);
    const systemInfo = getSystemInfo(workspace);
    const thinkingProcess = getThinkingProcess();

    // Assemble in priority order
    const sections = [
        prompt,
        toolsSection,
        toolInstructions,
        userRules,
        systemInfo,
        thinkingProcess,
    ].filter(Boolean);

    return sections.join('\n\n').trim();
}

// Re-export components
export { getAgentToolInstructions } from './tools';