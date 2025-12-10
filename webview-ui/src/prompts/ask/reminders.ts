/**
 * Ask Mode - Mid-conversation reminders
 * Only mentions tools available in Ask mode
 */

import type { Tool } from '../../types/tool';

/**
 * Get the system reminder for Ask mode
 */
export function getAskSystemReminder(enabledTools: Tool[]): string {
    const enabledToolNames = enabledTools.map(t => `\`${t.id}\``).join(', ') || '';

    const toolsMessage = enabledTools.length === 0
        ? '\nNo tools are currently enabled.'
        : `\nYOUR TOOLS: ${enabledToolNames}`;

    return `

<system_reminder>
Q&A MODE:${toolsMessage}
- Answer questions, do NOT implement changes
- Use tools only when needed for accurate answers
- Cite files and line numbers when referencing code
- Keep tool syntax internal
</system_reminder>`;
}

/**
 * Get todo context reminder for Ask mode
 */
export function getAskTodoReminder(): string {
    return '[Q&A MODE: Focus on answering the question.]';
}
