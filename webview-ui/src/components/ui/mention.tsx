import React from 'react';
import { vscode } from '../../utils/vscode';

interface MentionProps {
    text?: string;
    withShadow?: boolean;
}

/**
 * Mention component renders text and highlights ONLY valid @mentions with paths.
 * 
 * Validation Rules:
 * - @mentions: Only highlighted if they have an explicit path: @[label](path)
 *   - @[label] without path is NOT highlighted (could be invalid/manual typing)
 * - /[command] slash commands: NEVER highlighted in display (already resolved to content)
 * 
 * This prevents invalid patterns like @[random] or /[random] from being highlighted.
 */
export const Mention: React.FC<MentionProps> = ({ text, withShadow = false }) => {
    if (!text) {
        return <>{text}</>;
    }

    // Only match @mentions with explicit paths: @[label](path)
    // This ensures only validated/resolved mentions get highlighted
    const mentionWithPathRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionWithPathRegex.exec(text)) !== null) {
        // Add text before this match
        if (match.index > lastIndex) {
            parts.push(text.slice(lastIndex, match.index));
        }

        const fullMatch = match[0];
        const label = match[1];  // label
        const path = match[2];   // path

        parts.push(
            <span
                key={`mention-${match.index}`}
                className={`
                    inline-block
                    px-1
                    rounded
                    bg-blue-500/10 
                    text-blue-600 
                    dark:text-blue-400
                    cursor-pointer hover:bg-blue-500/20
                    transition-colors
                    ${withShadow ? "shadow-sm" : ""}
                `}
                onClick={() => {
                    vscode.postMessage({ type: "openMention", text: path });
                }}
                title={`Open ${path}`}
            >
                @{label}
            </span>
        );

        lastIndex = match.index + fullMatch.length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
    }

    return <>{parts}</>;
};
