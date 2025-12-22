import React from 'react';
import { vscode } from '../../utils/vscode';

interface MentionProps {
    text?: string;
    withShadow?: boolean;
}

// Regex for parsing @[label](path) or @[label] format - create new instance each time to avoid state issues
// The path part is optional to support manually typed mentions like @[filename]
const createMentionRegex = () => /@\[([^\]]+)\](?:\(([^)]+)\))?/g;

export const Mention: React.FC<MentionProps> = ({ text, withShadow = false }) => {
    if (!text) {
        return <>{text}</>;
    }

    // Parse mentions in format @[label](path)
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    const regex = createMentionRegex();

    while ((match = regex.exec(text)) !== null) {
        // Add text before this match
        if (match.index > lastIndex) {
            parts.push(text.slice(lastIndex, match.index));
        }

        const fullMatch = match[0]; // @[label](path) or @[label]
        const label = match[1];     // label
        const path = match[2];      // path (optional, undefined for manually typed)
        
        // Manual mentions (no path) are display-only, not clickable
        const isClickable = Boolean(path);

        parts.push(
            <span
                key={match.index}
                className={`
                    inline-block
                    px-1
                    rounded
                    bg-blue-500/10 
                    text-blue-600 
                    dark:text-blue-400
                    ${isClickable ? "cursor-pointer hover:bg-blue-500/20" : ""}
                    transition-colors
                    ${withShadow ? "shadow-sm" : ""}
                `}
                onClick={isClickable ? () => {
                    vscode.postMessage({ type: "openMention", text: path });
                } : undefined}
                title={isClickable ? `Open ${path}` : undefined}
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
