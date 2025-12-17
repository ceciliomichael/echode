import React from 'react';
import { mentionRegex } from '../../../utils/context-mentions';

interface HighlightRendererProps {
    value: string;
}

/**
 * Renders text with highlighted mentions
 * Mentions get a blue background while text remains transparent
 * (backdrop layer - actual text is shown in the textarea above)
 */
export function HighlightRenderer({ value }: HighlightRendererProps) {
    if (!value) return null;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    const regex = new RegExp(mentionRegex.source, 'g');

    while ((match = regex.exec(value)) !== null) {
        // Add text before this match (transparent)
        if (match.index > lastIndex) {
            parts.push(
                <span key={`text-${lastIndex}`} style={{ color: 'transparent' }}>
                    {value.slice(lastIndex, match.index)}
                </span>
            );
        }

        // Add the mention with blue background (text still transparent, just shows background)
        const fullMatch = match[0];
        parts.push(
            <span
                key={`mention-${match.index}`}
                style={{
                    backgroundColor: 'rgba(59, 130, 246, 0.25)',
                    borderRadius: '3px',
                    color: 'transparent',
                }}
            >
                {fullMatch}
            </span>
        );

        lastIndex = match.index + fullMatch.length;
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