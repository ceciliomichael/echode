import type { ChatMessage } from '../types/chat-api';
import type { ChatMode } from '../types/chat-mode';

export const CODE_QUALITY_REMINDER = "Check if my message involves code modifications, debugging, or architectural changes. IF AND ONLY IF it does, I have a strict requirement: you must strictly adhere to high standards of software quality (DRY, SOLID, modularity). Do not take shortcuts. If the request is a simple chat or question unrelated to code structure, you may ignore this requirement. Here is my request:\n\n";

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

            // Heuristic: Skip short messages (likely greetings, confirmations, etc.)
            // Assuming average word length of 5 chars + spaces. 10 words ~ 50 chars.
            // Let's be conservative: 20 chars. "Fix logic" is 9 chars. "Update file" is 11.
            // "yes" is 3. "ok" is 2.
            const cleanContent = contentString.trim();
            if (cleanContent.length < 10 && !cleanContent.toLowerCase().includes('fix') && !cleanContent.toLowerCase().includes('bug')) {
                continue;
            }

            // Found the last user prompt!
            // Wrap the message if not already wrapped
            if (typeof msg.content === 'string') {
                if (!msg.content.startsWith(CODE_QUALITY_REMINDER)) {
                    msg.content = `${CODE_QUALITY_REMINDER}"${msg.content}"`;
                }
            } else if (Array.isArray(msg.content)) {
                // Find the first text block to prepend the reminder, and wrap the content
                // Strategy: Find the main text part.
                // If multiple text blocks, this might be tricky, but usually it's one.
                // We will prepend the reminder to the *first* text block and wrap that block's content in quotes?
                // Or simply prepend a new text block with the reminder and open quote, and append a closing quote to the last text block?

                // Let's go with: Prepend reminder to the first text block found.
                // And wrap the *entire* textual content logic if possible. 
                // Simpler approach for array: Find the *last* text block (which usually contains the prompt) and wrap it?
                // Or just prepend the reminder string as a separate block?

                // If we follow the "wrapper" strictness:
                // PREFIX "CONTENT"

                // Let's modify the text blocks directly.
                let firstTextBlockIndex = -1;
                let lastTextBlockIndex = -1;

                for (let j = 0; j < msg.content.length; j++) {
                    if (msg.content[j].type === 'text') {
                        if (firstTextBlockIndex === -1) {firstTextBlockIndex = j;}
                        lastTextBlockIndex = j;
                    }
                }

                if (firstTextBlockIndex !== -1 && lastTextBlockIndex !== -1) {
                    const firstBlock = msg.content[firstTextBlockIndex];
                    if (firstBlock.type === 'text' && !firstBlock.text?.startsWith(CODE_QUALITY_REMINDER)) {
                        // Apply wrapper
                        // If it's the same block
                        if (firstTextBlockIndex === lastTextBlockIndex) {
                            msg.content[firstTextBlockIndex] = {
                                ...firstBlock,
                                text: `${CODE_QUALITY_REMINDER}"${firstBlock.text || ''}"`
                            };
                        } else {
                            // Multiple blocks: Open quote on first, close on last? 
                            // This assumes contiguous text which might not be true.
                            // Safer: Just wrap each text block? No that's noisy.
                            // Best effort: Prefix the first one.
                            msg.content[firstTextBlockIndex] = {
                                ...firstBlock,
                                text: `${CODE_QUALITY_REMINDER}"${firstBlock.text || ''}`
                            };
                            const lastBlock = msg.content[lastTextBlockIndex];
                            if (lastBlock.type === 'text') {
                                msg.content[lastTextBlockIndex] = {
                                    ...lastBlock,
                                    text: `${lastBlock.text || ''}"`
                                };
                            }
                        }
                    }
                } else {
                    // No text block found, push one?
                    msg.content.push({ type: 'text', text: `${CODE_QUALITY_REMINDER}""` });
                }
            }

            // Stop after injecting into the last one
            break;
        }
    }
    return history;
}
