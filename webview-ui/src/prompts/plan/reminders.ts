/**
 * Plan Mode - Mid-conversation reminders
 * Only mentions tools available in Plan mode
 */

import type { Tool } from '../../types/tool';

/**
 * Get the system reminder for Plan mode
 * Injected into user messages during streaming
 */
export function getPlanSystemReminder(enabledTools: Tool[]): string {
    const enabledToolNames = enabledTools.map(t => `\`${t.id}\``).join(', ') || '';

    const toolsMessage = enabledTools.length === 0
        ? '\nNo tools are currently enabled.'
        : `\nYOUR TOOLS: ${enabledToolNames}`;

    return `

<system_reminder>
PLANNING MODE:${toolsMessage}
- Explore and plan, do NOT implement
- Use plan_navigator FIRST if you have ANY questions or uncertainties
- Use todo_write to document your plan (after questions answered)
- Use plan_handoff ONLY when all questions are resolved
- If user sends a message instead of clicking button, handoff is invalidated
- Keep tool syntax internal
</system_reminder>`;
}

/**
 * Get todo context reminder for Plan mode
 */
export function getPlanTodoReminder(): string {
    return `[PLANNING MODE]
- Status: Planning phase (not implementation)
- If user chatted instead of clicking "Start Implementation": The previous handoff is INVALID. You must re-verify requirements, update the plan if needed, and call plan_handoff again.
- Use plan_navigator to ask questions if any uncertainties exist.
- Use plan_handoff only when plan is finalized and agreed upon.`;
}
