import { useMemo } from 'react';

interface MentionTextProps {
  text: string;
}

// Regex to match @mentions
const MENTION_REGEX = /@([^\s@]+)/g;

/**
 * Renders text with highlighted @mentions
 * All @mentions are highlighted (unlike MentionHighlighter which only shows registered ones)
 */
export function MentionText({ text }: MentionTextProps) {
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

      // Add the mention (including the @)
      result.push({ text: match[0], isMention: true });
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      result.push({ text: text.slice(lastIndex), isMention: false });
    }

    return result;
  }, [text]);

  return (
    <>
      {segments.map((segment, index) => (
        <span
          key={index}
          style={
            segment.isMention
              ? {
                  backgroundColor: 'rgba(55, 148, 255, 0.25)',
                  borderRadius: '3px',
                  padding: '1px 2px',
                }
              : undefined
          }
        >
          {segment.text}
        </span>
      ))}
    </>
  );
}
