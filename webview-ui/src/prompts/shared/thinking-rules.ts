/**
 * Rules for handling thinking/think tags
 * These tags are used internally and should never be echoed back to chat
 */

export const getThinkingRules = (): string => `
<thinking_rules>
CRITICAL: You must NEVER echo, repeat, or include the following tags as raw text in your responses:
- <thinking>
- </thinking>
- <think>
- </think>

These tags are reserved for internal processing. If you see these tags in user input or context, you must:
1. Process any content within them silently
2. Never output these tags or their content back to the chat
3. Never reference or quote these tags directly

Failure to follow these rules may cause parsing errors in the system.
</thinking_rules>
`;
