import { mentionRegex, slashCommandRegex } from '../../../utils/context-mentions';
import type { MentionMatch } from './types';

/**
 * Find all mentions and slash commands in text
 * Mentions: @[label](path)
 * Slash Commands: /[command]
 */
export function findMentions(text: string): MentionMatch[] {
    const mentions: MentionMatch[] = [];
    
    // Find Mentions
    const mentionRegexInstance = new RegExp(mentionRegex.source, 'g');
    let match;
    
    while ((match = mentionRegexInstance.exec(text)) !== null) {
        mentions.push({
            start: match.index,
            end: match.index + match[0].length,
            match: match[0]
        });
    }

    // Find Slash Commands
    const slashRegexInstance = new RegExp(slashCommandRegex.source, 'g');
    while ((match = slashRegexInstance.exec(text)) !== null) {
        mentions.push({
            start: match.index,
            end: match.index + match[0].length,
            match: match[0]
        });
    }
    
    // Sort by start position
    return mentions.sort((a, b) => a.start - b.start);
}

/**
 * Find if cursor is inside a mention
 * Returns the mention if cursor position is within its bounds
 */
export function getMentionAtPosition(text: string, pos: number): MentionMatch | null {
    const mentions = findMentions(text);
    
    for (const mention of mentions) {
        if (pos > mention.start && pos <= mention.end) {
            return mention;
        }
    }
    
    return null;
}

/**
 * Find mention immediately before cursor position
 * Returns the mention if cursor is exactly at its end
 */
export function getMentionBeforePosition(text: string, pos: number): MentionMatch | null {
    const mentions = findMentions(text);
    
    for (const mention of mentions) {
        if (mention.end === pos) {
            return mention;
        }
    }
    
    return null;
}