import { mentionRegex } from '../../../utils/context-mentions';
import type { MentionMatch } from './types';

/**
 * Find all mentions in text using the @[label](path) format
 */
export function findMentions(text: string): MentionMatch[] {
    const mentions: MentionMatch[] = [];
    const regex = new RegExp(mentionRegex.source, 'g');
    let match;
    
    while ((match = regex.exec(text)) !== null) {
        mentions.push({
            start: match.index,
            end: match.index + match[0].length,
            match: match[0]
        });
    }
    
    return mentions;
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