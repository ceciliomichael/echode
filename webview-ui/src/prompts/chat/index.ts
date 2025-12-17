/**
 * Chat Mode - Main prompt builder
 * Pure conversation mode - NO tools, minimal system info
 */

import type { WorkspaceContext } from '../../types/workspace';
import { getUserRules, getMinimalSystemInfo } from '../shared';
import { getChatPrompt } from './prompt';

export interface ChatPromptOptions {
    workspace: WorkspaceContext | null;
}

/**
 * Build the complete Chat mode system prompt
 * Note: NO tools, NO workspace file list
 */
export function buildChatPrompt(options: ChatPromptOptions): string {
    const { workspace } = options;

    // Monolithic prompt (rules + mode description)
    const prompt = getChatPrompt(workspace);

    const userRules = getUserRules(workspace);

    // Chat mode gets minimal system info (no file list)
    const systemInfo = getMinimalSystemInfo();

    // Assemble - Note: NO tools section
    const sections = [
        prompt,
        userRules,
        systemInfo,
    ].filter(Boolean);

    return sections.join('\n\n').trim();
}