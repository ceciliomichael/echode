/**
 * Agent Mode - Mid-conversation reminders
 * Only mentions tools available in Agent mode
 */

import type { Tool } from '../../types/tool';

/**
 * Get the system reminder for Agent mode
 * Injected into user messages during streaming
 */
export function getAgentSystemReminder(enabledTools: Tool[]): string {
    const enabledToolNames = enabledTools.map(t => `\`${t.id}\``).join(', ') || '';

    const toolsMessage = enabledTools.length === 0
        ? '\nNo tools are currently enabled.'
        : `\nYOUR TOOLS: ${enabledToolNames}`;

    return `

<system_reminder>
AGENT MODE:${toolsMessage}
- Read files before editing them
- Use apply_diff for targeted edits (copy SEARCH exactly)
- Use write_to_file for new files or complete rewrites
- Use todo_write to track progress
- Keep tool syntax internal
</system_reminder>`;
}

/**
 * Get todo context reminder for Agent mode
 */
export function getAgentTodoReminder(hasPendingTasks: boolean): string {
    if (hasPendingTasks) {
        return '[Use todo_write to mark tasks complete after finishing them.]';
    }
    return '[All tasks completed.]';
}
