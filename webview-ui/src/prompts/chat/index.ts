/**
 * Chat Mode - Main prompt builder
 * Pure conversation mode - NO workspace context, NO system info
 * Just a plain conversational AI assistant
 */

import type { WorkspaceContext } from '../../types/workspace';
import type { Tool } from '../../types/tool';
import { getChatPrompt } from './prompt';

export interface ChatPromptOptions {
    workspace: WorkspaceContext | null;
    enabledTools?: Tool[];
}

/**
 * Build the complete Chat mode system prompt
 * Note: Supports MCP tools if enabled, otherwise conversation only
 * NO workspace rules, NO system info - pure chat experience
 */
export function buildChatPrompt(options: ChatPromptOptions): string {
    const { workspace, enabledTools = [] } = options;

    // Just the chat prompt - no workspace context, no system info
    return getChatPrompt(workspace, enabledTools);
}