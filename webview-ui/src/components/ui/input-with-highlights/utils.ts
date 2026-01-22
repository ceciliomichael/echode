import { mentionRegex, slashCommandRegex } from '../../../utils/context-mentions';
import type { MentionMatch } from './types';

/**
 * Options for filtering mentions to only include valid ones
 */
interface FindMentionsOptions {
    /** Valid workflow names for slash commands (e.g., ['build', 'test']) */
    validWorkflowNames?: string[];
    /** Valid mention labels for @ mentions (e.g., ['file.ts', 'folder']) */
    validMentionLabels?: string[];
}

/**
 * Extract the command name from a slash command match
 * /[command] -> command
 */
function extractSlashCommandName(match: string): string | null {
    const slashMatch = match.match(/\/\[([^\]]+)\]/);
    return slashMatch ? slashMatch[1] : null;
}

/**
 * Find all mentions and slash commands in text
 * Mentions: @[label](path)
 * Slash Commands: /[command]
 * 
 * @param text - The text to search
 * @param options - Optional validation filters. If provided, only valid mentions are returned.
 */
export function findMentions(text: string, options?: FindMentionsOptions): MentionMatch[] {
    const mentions: MentionMatch[] = [];
    const { validWorkflowNames, validMentionLabels } = options || {};
    
    // Find Mentions
    // mentionRegex: /@\[([^\]]+)\](?:\(([^)]+)\))?/g
    // Group 1: label, Group 2: path (optional)
    const mentionRegexInstance = new RegExp(mentionRegex.source, 'g');
    let match;
    
    while ((match = mentionRegexInstance.exec(text)) !== null) {
        const label = match[1]; // The text inside @[...]
        const path = match[2];  // The text inside (...) if present
        
        // If validation list is provided, only include valid mentions
        // Valid if:
        // 1. It has a path (explicit file reference like @[file](path/to/file))
        // 2. OR it is in the validMentionLabels list (e.g., @[Codebase])
        if (validMentionLabels) {
            const hasPath = !!path;
            const isKnownLabel = label && validMentionLabels.includes(label);
            
            if (!hasPath && !isKnownLabel) {
                continue; // Skip only if it has NO path AND is NOT a known label
            }
        }
        
        mentions.push({
            start: match.index,
            end: match.index + match[0].length,
            match: match[0]
        });
    }

    // Find Slash Commands
    const slashRegexInstance = new RegExp(slashCommandRegex.source, 'g');
    while ((match = slashRegexInstance.exec(text)) !== null) {
        const commandName = extractSlashCommandName(match[0]);
        
        // If validation list is provided, only include valid slash commands
        if (validWorkflowNames && commandName) {
            if (!validWorkflowNames.includes(commandName)) {
                continue; // Skip invalid slash command
            }
        }
        
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
 * Options for position-based mention lookups
 */
interface MentionPositionOptions {
    validWorkflowNames?: string[];
    validMentionLabels?: string[];
}

/**
 * Find if cursor is inside a mention
 * Returns the mention if cursor position is within its bounds
 */
export function getMentionAtPosition(text: string, pos: number, options?: MentionPositionOptions): MentionMatch | null {
    const mentions = findMentions(text, options);
    
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
export function getMentionBeforePosition(text: string, pos: number, options?: MentionPositionOptions): MentionMatch | null {
    const mentions = findMentions(text, options);
    
    for (const mention of mentions) {
        if (mention.end === pos) {
            return mention;
        }
    }
    
    return null;
}