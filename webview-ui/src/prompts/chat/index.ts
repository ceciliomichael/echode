/**
 * Chat Mode - Main prompt builder
 * Pure conversational AI assistant - NO tools, NO AGENTS.md
 * Only custom instructions are allowed
 */

import type { WorkspaceContext } from '../../types/workspace';
import { getChatPrompt } from './prompt';

export interface ChatPromptOptions {
    workspace: WorkspaceContext | null;
    enabledTools?: unknown[]; // Kept for interface compatibility, but ignored
}

/**
 * Build the complete Chat mode system prompt
 * Custom instructions are injected inside getChatPrompt (no AGENTS.md)
 */
export function buildChatPrompt(options: ChatPromptOptions): string {
    void options;
    // enabledTools is ignored - Chat mode has no tools

    return getChatPrompt();
}