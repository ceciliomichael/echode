/**
 * Agent Mode - Main prompt builder
 * Assembles the complete Agent mode system prompt
 */

import type { WorkspaceContext } from '../../types/workspace';
import type { Tool } from '../../types/tool';
import { getUserRules, getSystemInfo } from '../shared';
import { getAgentPrompt } from './prompt';
import { getAgentToolInstructions } from './tools';
import type { ToolInstructionOptions } from './tools';
import { getToolSystemPrompt } from '../../lib/tool-config';

export interface AgentPromptOptions {
    workspace: WorkspaceContext | null;
    enabledTools: Tool[];
    model?: string;
    /** Enable full terminal access (bypass command restrictions) */
    fullTerminalAccess?: boolean;
}

/**
 * Build the complete Agent mode system prompt
 */
export function buildAgentPrompt(options: AgentPromptOptions, modeName: string = 'AGENT'): string {
    const { workspace, enabledTools, fullTerminalAccess = false, model } = options;

    // Filter out hidden tools from the main agent prompt
    const visibleTools = enabledTools.filter(t => !t.hidden);

    // Tool format section (generic XML format)
    const toolsSection = visibleTools.length > 0
        ? getToolSystemPrompt(visibleTools, model)
        : `<tool_status>
No tools are currently enabled.
</tool_status>`;

    // Build tool instruction options
    const toolOptions: ToolInstructionOptions = {
        fullTerminalAccess,
        shellType: workspace?.shellType,
    };

    // Mode-specific tool instructions
    const toolInstructions = getAgentToolInstructions(enabledTools, toolOptions);

    // Monolithic prompt (cognitive workflow + rules + mode description)
    const prompt = getAgentPrompt(workspace, enabledTools, modeName);

    const userRules = getUserRules(workspace);
    const terminalEnabled = enabledTools.some(t => t.id === 'run_terminal');
    const systemInfo = getSystemInfo(workspace, { terminalEnabled });

    // Assemble in priority order
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
export { getAgentToolInstructions } from './tools';
export type { ToolInstructionOptions } from './tools';