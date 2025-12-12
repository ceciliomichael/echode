/**
 * Chat Mode - Main prompt builder
 * Pure conversation mode - NO tools, minimal system info
 */

import type { WorkspaceContext } from '../../types/workspace';
import { getUserRules, getMinimalSystemInfo } from '../shared';
import { getChatModeSection } from './mode-section';
import { getChatRules } from './rules';

export interface ChatPromptOptions {
    workspace: WorkspaceContext | null;
}

/**
 * Build the complete Chat mode system prompt
 * Note: NO tools, NO workspace file list
 */
export function buildChatPrompt(options: ChatPromptOptions): string {
    const { workspace } = options;

    const rules = getChatRules();
    const modeSection = getChatModeSection();
    const userRules = getUserRules(workspace);

    // Chat mode gets minimal system info (no file list)
    const systemInfo = getMinimalSystemInfo();

    // Assemble - Note: NO tools section, NO tool chains
    const sections = [
        rules,
        modeSection,
        userRules,
        systemInfo,
    ].filter(Boolean);

    return sections.join('\n\n').trim();
}

// Re-export components
export { getChatModeSection } from './mode-section';
export { getChatRules } from './rules';

/**
 * Chat mode has NO reminders since it has NO tools
 * This is intentionally NOT exported to prevent accidental use
 */
