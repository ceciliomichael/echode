/**
 * Chat Mode - Main prompt builder
 * Conversational AI assistant with AGENTS.md context support
 */

import type { WorkspaceContext } from '../../types/workspace';
import type { Tool } from '../../types/tool';
import { getUserRules } from '../shared';
import { getChatPrompt } from './prompt';

export interface ChatPromptOptions {
    workspace: WorkspaceContext | null;
    enabledTools?: Tool[];
}

/**
 * Build the complete Chat mode system prompt
 * Includes AGENTS.md and custom system prompt if present
 */
export function buildChatPrompt(options: ChatPromptOptions): string {
    const { workspace, enabledTools = [] } = options;

    const prompt = getChatPrompt(workspace, enabledTools);
    const userRules = getUserRules(workspace);

    return [prompt, userRules].filter(Boolean).join('\n\n').trim();
}