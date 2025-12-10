
import type { Message } from '../types/chat';
import type { ToolExecutionState } from '../types/tool';

// Planning tool names that should be superseded when user sends a new message
export const PLANNING_TOOL_NAMES = ['plan_navigator', 'plan_handoff'];

/**
 * Marks active planning tools as superseded in the message history.
 * This is used when the user sends a new message, invalidating previous planning options.
 */
export function supersedePlanningToolsInMessages(messages: Message[]): Message[] {
    let hasChanges = false;

    const newMessages = messages.map(msg => {
        if (msg.role !== 'assistant' || !msg.toolExecutions) {
            return msg;
        }

        const newToolExecutions = new Map(msg.toolExecutions);
        let messageChanged = false;

        for (const [execId, execution] of newToolExecutions.entries()) {
            if (!PLANNING_TOOL_NAMES.includes(execution.toolName)) {
                continue;
            }

            const data = execution.result?.data as Record<string, unknown> | undefined;

            // Skip if already superseded or acted upon (though specifically for handoff we might want to supersede even if clicked? No, clicked means done.)
            // Actually per requirements: "Make sure plan_handoff button disables correctly... if user sends a new message without interacting with the button"

            if (data?.superseded) continue;
            if (execution.toolName === 'plan_navigator' && data?.selectedIndex !== undefined) continue;
            if (execution.toolName === 'plan_handoff' && data?.clicked) continue;

            const updatedExecution: ToolExecutionState = {
                ...execution,
                result: {
                    ...execution.result,
                    success: execution.result?.success ?? true,
                    data: { ...data, superseded: true },
                },
            };
            newToolExecutions.set(execId, updatedExecution);
            messageChanged = true;
            hasChanges = true;
        }

        if (messageChanged) {
            return { ...msg, toolExecutions: newToolExecutions };
        }
        return msg;
    });

    return hasChanges ? newMessages : messages;
}
