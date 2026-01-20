/**
 * Chat Mode - Main Prompt
 * 
 * Structure:
 * - <identity>: Versatile AI assistant
 * - <capabilities>: Pure conversation (no tools)
 * - <communication_style>: Natural conversation
 * - <rules>: Dynamic constraints
 * - <user_rules>: Custom instructions only (no AGENTS.md)
 * 
 * NOTE: Chat mode is a pure conversational mode.
 * NO workspace access, NO tools (standard or MCP), NO AGENTS.md context.
 * Only user-defined custom instructions are injected.
 */

import type { WorkspaceContext } from '../../types/workspace';
import { IMAGE_AWARENESS_RULES } from '../shared';
import { getUserRules } from '../shared/user-rules';
import { 
    CHAT_IDENTITY, 
    CHAT_STYLE, 
    getCapabilities, 
    getRules 
} from './sections';

export function getChatPrompt(_workspace: WorkspaceContext | null): string {
    // Chat mode has no tools - pure conversation only
    const hasTools = false;

    // Get custom instructions only (pass null to exclude AGENTS.md)
    const customInstructions = getUserRules(null);

    return `<chat_mode>
${CHAT_IDENTITY}

${getCapabilities(hasTools)}

${CHAT_STYLE}

${getRules(hasTools)}
${customInstructions ? '\n' + customInstructions : ''}
${IMAGE_AWARENESS_RULES}
</chat_mode>`;
}