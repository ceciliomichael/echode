/**
 * Chat Mode - Main prompt builder
 * Pure conversation mode - NO tools, minimal system info
 */

import type { WorkspaceContext } from '../../types/workspace';
import type { Tool } from '../../types/tool';
import { getUserRules, getMinimalSystemInfo } from '../shared';
import { getChatPrompt } from './prompt';

export interface ChatPromptOptions {
    workspace: WorkspaceContext | null;
    enabledTools?: Tool[];
}

/**
 * Build the complete Chat mode system prompt
 * Note: Supports MCP tools if enabled, otherwise conversation only
 */
export function buildChatPrompt(options: ChatPromptOptions): string {
    const { workspace, enabledTools = [] } = options;

    // Monolithic prompt (rules + mode description)
    const prompt = getChatPrompt(workspace, enabledTools);

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