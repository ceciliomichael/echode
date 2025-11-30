import { useMemo } from 'react';
import { getMentionPath, unescapeSpaces } from '../../utils/mention-utils';

interface MentionHighlighterProps {
  text: string;
  scrollTop?: number;
  // When true, highlight all @mentions regardless of registration
  highlightAll?: boolean;
}

// Regex to match @mentions - local copy to avoid modifying global state
const MENTION_REGEX = /@((?:[^\s@]|\\ )+)/g;

/**
 * Renders text with highlighted @mentions
 * Only highlights mentions that were selected from the context menu
 * (i.e., those registered in the mentionPathMap)
 */
export function MentionHighlighter({ text, scrollTop = 0, highlightAll = false }: MentionHighlighterProps) {
  const segments = useMemo(() => {
    const result: Array<{ text: string; isMention: boolean }> = [];
    let lastIndex = 0;
    let match;

    // Create new regex instance to avoid state issues
    const regex = new RegExp(MENTION_REGEX.source, 'g');

    while ((match = regex.exec(text)) !== null) {
      // Add text before the mention
      if (match.index > lastIndex) {
        result.push({ text: text.slice(lastIndex, match.index), isMention: false });
      }

      // Determine if this mention should be highlighted
      // Default: only highlight if it was registered (selected from context menu)
      // When highlightAll is true (edit mode), highlight all @mentions
      const mentionText = unescapeSpaces(match[1]);
      const isRegisteredMention = highlightAll || getMentionPath(mentionText) !== undefined;

      // Add the mention (including the @)
      result.push({ text: match[0], isMention: isRegisteredMention });
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      result.push({ text: text.slice(lastIndex), isMention: false });
    }

    return result;
  }, [text, highlightAll]);

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          transform: `translateY(${-scrollTop}px)`,
          // Match textarea: px-1.5 py-1 = 6px 4px
          padding: '4px 6px',
          // Match textarea: text-sm leading-tight
          fontSize: '0.875rem',
          lineHeight: '1.25',
          fontFamily: 'inherit',
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
          overflowWrap: 'break-word',
          color: 'transparent',
        }}
      >
        {segments.map((segment, index) => (
          <span
            key={index}
            style={
              segment.isMention
                ? {
                    // Blue highlight background for mentions
                    backgroundColor: 'rgba(55, 148, 255, 0.25)',
                    color: 'transparent',
                    borderRadius: '3px',
                  }
                : undefined
            }
          >
            {segment.text}
          </span>
        ))}
      </div>
    </div>
  );
}
