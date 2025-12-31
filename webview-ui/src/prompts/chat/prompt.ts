/**
 * Chat Mode - Main Prompt
 * 
 * Structure:
 * - <identity>: Versatile AI assistant
 * - <capabilities>: Dynamic based on tool availability
 * - <communication_style>: Natural conversation
 * - <rules>: Dynamic constraints
 * 
 * NOTE: Chat mode is a pure conversational mode - NO workspace access, NO agent tools.
 * Only MCP tools (if enabled) are available.
 */

import type { WorkspaceContext } from '../../types/workspace';
import type { Tool } from '../../types/tool';
import { IMAGE_AWARENESS_RULES } from '../shared';
import { 
    CHAT_IDENTITY, 
    CHAT_STYLE, 
    getCapabilities, 
    getRules 
} from './sections';

export function getChatPrompt(_workspace: WorkspaceContext | null, enabledTools: Tool[] = []): string {
    const hasTools = enabledTools.length > 0;

    // Only show tools context if MCP tools are enabled
    const toolsContext = hasTools
        ? `<available_tools>
Tools: ${enabledTools.map(t => t.id).join(', ')}
Note: Use these tools only when necessary to fulfill the user's request.
</available_tools>`
        : '';

    return `<chat_mode>
${CHAT_IDENTITY}

${getCapabilities(hasTools)}

${CHAT_STYLE}

${getRules(hasTools)}
${toolsContext ? '\n' + toolsContext : ''}
${IMAGE_AWARENESS_RULES}
</chat_mode>`;
}