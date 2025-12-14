/**
 * Ask Mode - Main prompt builder
 */

import type { WorkspaceContext } from '../../types/workspace';
import type { Tool } from '../../types/tool';
import { getUserRules, getSystemInfo, getThinkingProcess } from '../shared';
import { getAskPrompt } from './prompt';
import { getAskToolInstructions } from './tools';
import { getToolSystemPrompt } from '../../lib/tool-config';

export interface AskPromptOptions {
    workspace: WorkspaceContext | null;
    enabledTools: Tool[];
}

/**
 * Build the complete Ask mode system prompt
 */
export function buildAskPrompt(options: AskPromptOptions): string {
    const { workspace, enabledTools } = options;

    // Tool format section
    const toolsSection = enabledTools.length > 0
        ? getToolSystemPrompt(enabledTools)
        : `<tool_status>
No tools are currently enabled.
</tool_status>`;

    // Mode-specific tool instructions (Ask-specific, no editing mentions)
    const toolInstructions = getAskToolInstructions(enabledTools);

    // Monolithic prompt (rules + mode description)
    const prompt = getAskPrompt(workspace, enabledTools);

    const userRules = getUserRules(workspace);
    const systemInfo = getSystemInfo(workspace);
    const thinkingProcess = getThinkingProcess();

    // Assemble
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
export { getAskToolInstructions } from './tools';