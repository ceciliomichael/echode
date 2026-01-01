import React from 'react';
import { mentionRegex } from '../../../utils/context-mentions';

interface HighlightRendererProps {
    value: string;
}

interface MatchInfo {
    index: number;
    length: number;
    text: string;
    type: 'mention' | 'slashCommand';
}

/**
 * Renders text with highlighted mentions and slash commands
 * Both get a blue background while text remains transparent
 * (backdrop layer - actual text is shown in the textarea above)
 */
export function HighlightRenderer({ value }: HighlightRendererProps) {
    if (!value) return null;

    // Collect all matches (mentions and slash commands)
    const allMatches: MatchInfo[] = [];

    // Find @[...] mentions
    const mentionRegexInstance = new RegExp(mentionRegex.source, 'g');
    let match;
    while ((match = mentionRegexInstance.exec(value)) !== null) {
        allMatches.push({
            index: match.index,
            length: match[0].length,
            text: match[0],
            type: 'mention'
        });
    }

    // Find /[command] slash commands (with brackets, similar to @[mention])
    // Use a simpler regex without lookbehind for broader compatibility
    const slashMatches = value.matchAll(/(?:^|\s)(\/\[[a-zA-Z0-9_-]+\])(?=\s|$)/g);
    for (const slashMatch of slashMatches) {
        const commandText = slashMatch[1]; // The captured group (just /command)
        const fullMatch = slashMatch[0];
        // Calculate the actual start of /command (after any leading whitespace)
        const commandIndex = slashMatch.index! + (fullMatch.length - commandText.length);
        
        allMatches.push({
            index: commandIndex,
            length: commandText.length,
            text: commandText,
            type: 'slashCommand'
        });
    }

    // Sort by index and remove overlaps (mentions take priority)
    allMatches.sort((a, b) => a.index - b.index);

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    for (const matchInfo of allMatches) {
        // Skip if this match overlaps with previous content
        if (matchInfo.index < lastIndex) continue;

        // Add text before this match (transparent)
        if (matchInfo.index > lastIndex) {
            parts.push(
                <span key={`text-${lastIndex}`} style={{ color: 'transparent' }}>
                    {value.slice(lastIndex, matchInfo.index)}
                </span>
            );
        }

        // Add the highlighted text (mention or slash command)
        const bgColor = matchInfo.type === 'slashCommand' 
            ? 'rgba(168, 85, 247, 0.25)' // Purple for slash commands
            : 'rgba(59, 130, 246, 0.25)'; // Blue for mentions
        
        parts.push(
            <span
                key={`${matchInfo.type}-${matchInfo.index}`}
                style={{
                    backgroundColor: bgColor,
                    borderRadius: '3px',
                    color: 'transparent',
                }}
            >
                {matchInfo.text}
            </span>
        );

        lastIndex = matchInfo.index + matchInfo.length;
    }

    // Add remaining text
    if (lastIndex < value.length) {
        parts.push(
            <span key={`text-${lastIndex}`} style={{ color: 'transparent' }}>
                {value.slice(lastIndex)}
            </span>
        );
    }

    return parts.length > 0 ? <>{parts}</> : <span style={{ color: 'transparent' }}>{value}</span>;
}