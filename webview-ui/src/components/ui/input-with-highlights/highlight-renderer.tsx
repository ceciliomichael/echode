import React from 'react';
import { mentionRegex, slashCommandRegex } from '../../../utils/context-mentions';

interface HighlightRendererProps {
    value: string;
    /** Valid workflow command names for slash command validation */
    validWorkflowNames?: string[];
    /** Map of valid mention labels to their paths (from context menu selections) */
    validMentionLabels?: Map<string, string>;
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
 * 
 * Validation Rules:
 * - Mentions (@[label] or @[label](path)):
 *   - If has path (group 2): Always valid (explicitly resolved)
 *   - If only label: Must exist in validMentionLabels map
 * - Slash Commands (/[command]):
 *   - Must exist in validWorkflowNames array
 */
export function HighlightRenderer({ 
    value, 
    validWorkflowNames = [], 
    validMentionLabels 
}: HighlightRendererProps) {
    if (!value) return null;

    // Collect all matches (mentions and slash commands)
    const allMatches: MatchInfo[] = [];

    // Find @[...] mentions - validate before adding
    // mentionRegex: /@\[([^\]]+)\](?:\(([^)]+)\))?/g
    // Group 1: label, Group 2: path (optional)
    const mentionRegexInstance = new RegExp(mentionRegex.source, 'g');
    let match;
    while ((match = mentionRegexInstance.exec(value)) !== null) {
        const label = match[1]; // The text inside @[...]
        const path = match[2];  // The text inside (...) if present
        
        // Validation: Valid if has path OR label exists in validMentionLabels
        const hasPath = !!path;
        const isKnownLabel = validMentionLabels?.has(label) ?? false;
        
        if (hasPath || isKnownLabel) {
            allMatches.push({
                index: match.index,
                length: match[0].length,
                text: match[0],
                type: 'mention'
            });
        }
    }

    // Find /[command] slash commands - validate before adding
    // slashCommandRegex: /\/\[([^\]]+)\]/g
    // Group 1: command name
    const slashRegexInstance = new RegExp(slashCommandRegex.source, 'g');
    while ((match = slashRegexInstance.exec(value)) !== null) {
        const commandName = match[1]; // The text inside /[...]
        
        // Validation: Command must exist in validWorkflowNames
        if (validWorkflowNames.includes(commandName)) {
            allMatches.push({
                index: match.index,
                length: match[0].length,
                text: match[0],
                type: 'slashCommand'
            });
        }
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
                    // Allow highlight to break across lines and style each fragment
                    WebkitBoxDecorationBreak: 'clone',
                    boxDecorationBreak: 'clone',
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