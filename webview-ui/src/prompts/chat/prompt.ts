/**
 * Chat Mode - Main Prompt
 * 
 * Structure:
 * - <identity>: Versatile AI assistant
 * - <context>: Workspace and tools (if any)
 * - <isolation>: Separation from project content
 * - <capabilities>: Dynamic based on tool availability
 * - <communication_style>: Natural conversation
 * - <rules>: Dynamic constraints
 */

import type { WorkspaceContext } from '../../types/workspace';
import type { Tool } from '../../types/tool';
import { IMAGE_AWARENESS_RULES, getIsolationRules } from '../shared';
import { 
    CHAT_IDENTITY, 
    CHAT_STYLE, 
    getCapabilities, 
    getRules 
} from './sections';

export function getChatPrompt(workspace: WorkspaceContext | null, enabledTools: Tool[] = []): string {
    const hasTools = enabledTools.length > 0;
    const cwd = workspace?.path || 'No workspace';
    
    const toolList = hasTools 
        ? enabledTools.map(t => t.id).join(', ') 
        : 'None - conversation only';

    return `<chat_mode>
${CHAT_IDENTITY}

<context>
Workspace: ${cwd}
Tools: ${toolList}
</context>

${getIsolationRules('context')}

${getCapabilities(hasTools)}

${CHAT_STYLE}

${getRules(hasTools)}

${IMAGE_AWARENESS_RULES}
</chat_mode>`;
}