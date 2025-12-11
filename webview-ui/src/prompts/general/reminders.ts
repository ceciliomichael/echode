/**
 * General Mode - Mid-conversation reminders
 * Only mentions tools available in General mode
 */

import type { Tool } from '../../types/tool';

/**
 * Get the system reminder for General mode
 */
export function getGeneralSystemReminder(enabledTools: Tool[]): string {
    const enabledToolNames = enabledTools.map(t => `\`${t.id}\``).join(', ') || '';

    const toolsMessage = enabledTools.length === 0
        ? '\nNo tools are currently enabled.'
        : `\nYOUR TOOLS: ${enabledToolNames}`;

    return `

<system_reminder>
GENERAL MODE:${toolsMessage}
- Default to explaining and suggesting changes in prose
- Read files before editing them
- Use apply_diff only for small, targeted edits in a single file
- Use write_to_file for new files or rare, small-scope complete rewrites
- For large or risky changes, recommend switching to Plan/Agent mode
- Keep tool syntax internal
</system_reminder>`;
}

/**
 * Get todo context reminder for General mode
 */
export function getGeneralTodoReminder(hasPendingTasks: boolean): string {
    if (hasPendingTasks) {
        return '[Update the todo list after completing tasks.]';
    }
    return '[All tasks completed.]';
}
