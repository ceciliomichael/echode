/**
 * MentionHighlighter Utility
 * 
 * Parses text content and renders highlighted spans for @file.ext mentions
 * that were selected from the menu (not manually typed).
 */

import type { FileMention } from '../types/file-mention';

/**
 * Check if a given character offset falls within a menu-selected mention
 */
export function isMenuSelectedMention(
    offset: number,
    mentions: FileMention[]
): FileMention | null {
    for (const mention of mentions) {
        if (offset >= mention.startOffset && offset < mention.endOffset && mention.selectedFromMenu) {
            return mention;
        }
    }
    return null;
}

/**
 * Parse mention patterns from text
 * Returns array of { start, end, text } for each @filename.ext pattern
 */
export function parseMentionPatterns(text: string): Array<{ start: number; end: number; text: string }> {
    const patterns: Array<{ start: number; end: number; text: string }> = [];
    const regex = /@[\w.-]+/g;

    let match;
    while ((match = regex.exec(text)) !== null) {
        patterns.push({
            start: match.index,
            end: match.index + match[0].length,
            text: match[0],
        });
    }

    return patterns;
}

/**
 * Build highlighted segments from text and mentions
 * Returns array of { text, isHighlighted } segments for rendering
 */
export function buildHighlightedSegments(
    text: string,
    mentions: FileMention[]
): Array<{ text: string; isHighlighted: boolean; key: string }> {
    if (!text) return [];

    const segments: Array<{ text: string; isHighlighted: boolean; key: string }> = [];
    const patterns = parseMentionPatterns(text);

    let lastEnd = 0;

    for (const pattern of patterns) {
        // Add non-highlighted text before this pattern
        if (pattern.start > lastEnd) {
            segments.push({
                text: text.slice(lastEnd, pattern.start),
                isHighlighted: false,
                key: `text-${lastEnd}`,
            });
        }

        // Check if this pattern is a menu-selected mention
        const mention = isMenuSelectedMention(pattern.start, mentions);

        segments.push({
            text: pattern.text,
            isHighlighted: mention !== null,
            key: `mention-${pattern.start}`,
        });

        lastEnd = pattern.end;
    }

    // Add remaining text after last pattern
    if (lastEnd < text.length) {
        segments.push({
            text: text.slice(lastEnd),
            isHighlighted: false,
            key: `text-${lastEnd}`,
        });
    }

    // If no patterns found, return the whole text as one segment
    if (segments.length === 0) {
        segments.push({
            text,
            isHighlighted: false,
            key: 'text-0',
        });
    }

    return segments;
}

/**
 * CSS styles for the blue highlight on menu-selected mentions
 */
export const MENTION_HIGHLIGHT_STYLE: React.CSSProperties = {
    color: 'var(--vscode-textLink-foreground)',
    fontWeight: 500,
};
