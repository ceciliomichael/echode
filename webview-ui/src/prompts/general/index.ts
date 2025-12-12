/**
 * General Mode - Main prompt builder
 */

import type { WorkspaceContext } from '../../types/workspace';
import type { Tool } from '../../types/tool';
import { getUserRules, getSystemInfo } from '../shared';
import { getGeneralPrompt } from './prompt';
import { getGeneralToolInstructions } from './tools';
import { getToolSystemPrompt } from '../../lib/tool-config';

export interface GeneralPromptOptions {
    workspace: WorkspaceContext | null;
    enabledTools: Tool[];
}

/**
 * Build the complete General mode system prompt
 */
export function buildGeneralPrompt(options: GeneralPromptOptions): string {
    const { workspace, enabledTools } = options;

    // Tool format section
    const toolsSection = enabledTools.length > 0
        ? getToolSystemPrompt(enabledTools)
        : `<tool_status>
No tools are currently enabled.
</tool_status>`;

    // Mode-specific tool instructions
    const toolInstructions = getGeneralToolInstructions(enabledTools);

    // Monolithic prompt (rules + mode description)
    const prompt = getGeneralPrompt(workspace);

    const userRules = getUserRules(workspace);
    const systemInfo = getSystemInfo(workspace);

    // Assemble
    const sections = [
        prompt,
        toolsSection,
        toolInstructions,
        userRules,
        systemInfo,
    ].filter(Boolean);

    return sections.join('\n\n').trim();
}

// Re-export components
export { getGeneralToolInstructions } from './tools';