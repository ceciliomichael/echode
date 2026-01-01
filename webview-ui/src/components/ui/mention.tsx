import React from 'react';
import { vscode } from '../../utils/vscode';

interface MentionProps {
    text?: string;
    withShadow?: boolean;
}

// Combined regex for parsing both @[label](path) mentions and /[command] slash commands
// Group 1: Full @mention match
// Group 2: @mention label
// Group 3: @mention path (optional)
// Group 4: Full /[command] match
// Group 5: Slash command name
const createCombinedRegex = () => /(@\[([^\]]+)\](?:\(([^)]+)\))?)|(\/\[([a-zA-Z0-9_-]+)\])/g;

export const Mention: React.FC<MentionProps> = ({ text, withShadow = false }) => {
    if (!text) {
        return <>{text}</>;
    }

    // Parse both @mentions and /[commands]
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    const regex = createCombinedRegex();

    while ((match = regex.exec(text)) !== null) {
        // Add text before this match
        if (match.index > lastIndex) {
            parts.push(text.slice(lastIndex, match.index));
        }

        const fullMatch = match[0];
        
        // Check if this is an @mention (group 1) or /[command] (group 4)
        if (match[1]) {
            // @mention match
            const label = match[2];     // label
            const path = match[3];      // path (optional)
            
            // Manual mentions (no path) are display-only, not clickable
            const isClickable = Boolean(path);

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
        } else if (match[4]) {
            // /[command] slash command match
            const commandName = match[5]; // command name without /[ ]

            parts.push(
                <span
                    key={`command-${match.index}`}
                    className={`
                        inline-block
                        px-1
                        rounded
                        bg-purple-500/10 
                        text-purple-600 
                        dark:text-purple-400
                        transition-colors
                        ${withShadow ? "shadow-sm" : ""}
                    `}
                    title={`Workflow: ${commandName}`}
                >
                    /{commandName}
                </span>
            );
        }

        lastIndex = match.index + fullMatch.length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
    }

    return <>{parts}</>;
};
