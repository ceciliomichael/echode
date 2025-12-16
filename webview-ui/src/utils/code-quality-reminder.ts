import type { ChatMessage } from '../types/chat-api';
import type { ChatMode } from '../types/chat-mode';

export const CODE_QUALITY_REMINDER = `

<code_standards priority="high">
**Planning & Communication**
- When given a development task, ALWAYS mention the files you will create/modify upfront
- List the file paths and their purpose before implementation
- This ensures clarity and proper file organization from the start

**DRY (Don't Repeat Yourself)**
- If you write similar code twice, extract it into a reusable function/component
- Shared logic belongs in utils, hooks, or services
- Constants should be defined once and imported

**SOLID Principles**
- Single Responsibility: Each function/component does ONE thing well
- Open/Closed: Design for extension without modification
- Liskov Substitution: Subtypes must be substitutable for their base types
- Interface Segregation: Prefer small, focused interfaces
- Dependency Inversion: Depend on abstractions, not concrete implementations

**Type Safety**
- NEVER use 'any' - always define proper types/interfaces
- Use generics for flexible, reusable typed functions
- Validate external data and cast to defined types

**Scalability Mindset**
- Write code that handles growth (more data, more users, more features)
- Keep files modular - split when a file exceeds ~200 lines
- Use clear naming that explains intent without comments
- Add error handling for all async operations and edge cases

Apply these naturally as you code. Quality is non-negotiable.
</code_standards>`;

/**
 * Injects a code quality reminder into the last user message of the chat history.
 * Scans backwards to find the last "real" user message (skipping tool results).
 * Only applies in 'plan' and 'agent' modes.
 */
export function injectCodeQualityReminder(history: ChatMessage[], mode: ChatMode): ChatMessage[] {
    // Only inject in specific modes
    if (mode !== 'plan' && mode !== 'agent') {
        return history;
    }

    // Iterate backwards to find the last true user message
    for (let i = history.length - 1; i >= 0; i--) {
        const msg = history[i];
        if (msg.role === 'user') {
            // Check content logic
            let contentString = '';
            if (typeof msg.content === 'string') {
                contentString = msg.content;
            } else {
                contentString = msg.content.map(c => c.type === 'text' ? c.text : '').join('');
            }

            // Skip tool execution result messages
            if (contentString.includes('<tool_results>') || contentString.includes('<previous_tool_results>')) {
                continue;
            }

            // Found the last user prompt!
            // Append reminder if not already present
            if (typeof msg.content === 'string') {
                if (!msg.content.includes(CODE_QUALITY_REMINDER)) {
                    msg.content = msg.content + CODE_QUALITY_REMINDER;
                }
            } else if (Array.isArray(msg.content)) {
                // Check if last block is text and has reminder
                const lastBlock = msg.content[msg.content.length - 1];
                const hasReminder = lastBlock && lastBlock.type === 'text' && lastBlock.text && lastBlock.text.includes(CODE_QUALITY_REMINDER);

                if (!hasReminder) {
                    msg.content.push({ type: 'text', text: CODE_QUALITY_REMINDER });
                }
            }

            // Stop after injecting into the last one
            break;
        }
    }
    return history;
}
