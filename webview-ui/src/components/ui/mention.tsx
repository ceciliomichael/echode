import React from 'react';
import { vscode } from '../../utils/vscode';

interface MentionProps {
    text?: string;
    withShadow?: boolean;
}

// Regex for parsing @[label](path) format - create new instance each time to avoid state issues
const createMentionRegex = () => /@\[([^\]]+)\]\(([^)]+)\)/g;

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

        const fullMatch = match[0]; // @[label](path)
        const label = match[1];     // label
        const path = match[2];      // path

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
                    cursor-pointer
                    hover:bg-blue-500/20
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
