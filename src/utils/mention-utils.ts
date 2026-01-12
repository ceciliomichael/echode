import { ChatMessage } from '../services/llm/llm-provider.interface';

/**
 * Regex for detecting context mentions in the format @[label](path)
 * Matches: @[filename.ts](src/filename.ts)
 */
export const MENTION_REGEX = /@\[([^\]]+)\]\(([^)]+)\)/g;

/**
 * Injects a system hint into the last user message if file mentions are detected.
 * This encourages the AI to read the files explicitly referenced by the user.
 * 
 * @param messages The chat history to process (mutates in place)
 */
export function injectMentionInstructions(messages: ChatMessage[]): void {
  // Find the last message from the user
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');

  if (!lastUserMessage) {
    return;
  }

  const mentions = new Set<string>();
  
  // Extract mentions from string content
  if (typeof lastUserMessage.content === 'string') {
    let match;
    while ((match = MENTION_REGEX.exec(lastUserMessage.content)) !== null) {
      // match[1] is label, match[2] is path
      mentions.add(match[2]);
    }
  } 
  // Extract mentions from multimodal content
  else if (Array.isArray(lastUserMessage.content)) {
    for (const part of lastUserMessage.content) {
      if (part.type === 'text' && part.text) {
        let match;
        while ((match = MENTION_REGEX.exec(part.text)) !== null) {
          mentions.add(match[2]);
        }
      }
    }
  }

  if (mentions.size === 0) {
    return;
  }

  // Filter out special mentions like __problems__
  const filePaths = Array.from(mentions).filter(path => path !== '__problems__');

  if (filePaths.length === 0) {
    return;
  }

  const instruction = `\n\n<system_note>\nThe user referenced the following files: ${filePaths.join(', ')}\nYou should likely read these files using 'read_file' to understand the context.\n</system_note>`;

  // Append instruction to the message
  if (typeof lastUserMessage.content === 'string') {
    lastUserMessage.content += instruction;
  } else if (Array.isArray(lastUserMessage.content)) {
    const textPart = lastUserMessage.content.find(p => p.type === 'text');
    if (textPart && textPart.text) {
      textPart.text += instruction;
    } else {
      // If no text part exists (unlikely for a message with mentions), append one
      lastUserMessage.content.push({
        type: 'text',
        text: instruction
      });
    }
  }
}