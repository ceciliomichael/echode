import { useLayoutEffect, useMemo, useState, type RefObject } from 'react';
import { getMentionPath, unescapeSpaces } from '../../utils/mention-utils';

interface MentionHighlighterProps {
  text: string;
  scrollTop?: number;
  // When true, highlight all @mentions regardless of registration
  highlightAll?: boolean;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
}

// Regex to match @mentions - local copy to avoid modifying global state
const MENTION_REGEX = /@((?:[^\s@]|\\ )+)/g;

/**
 * Renders text with styled @mentions (blue text color)
 * This overlay renders ALL text visibly - the textarea text should be transparent
 * Only mentions that were selected from the context menu get blue color
 * (i.e., those registered in the mentionPathMap)
 */
export function MentionHighlighter({ text, scrollTop = 0, highlightAll = false, textareaRef }: MentionHighlighterProps) {
  const segments = useMemo(() => {
    const result: Array<{ text: string; isMention: boolean }> = [];

    // Process @mentions
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

  const [computedStyles, setComputedStyles] = useState<Pick<CSSStyleDeclaration, 'paddingTop' | 'paddingRight' | 'paddingBottom' | 'paddingLeft' | 'fontSize' | 'lineHeight' | 'fontFamily'> | null>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef?.current;
    if (!textarea) {
      return;
    }

    const styles = window.getComputedStyle(textarea);
    setComputedStyles({
      paddingTop: styles.paddingTop,
      paddingRight: styles.paddingRight,
      paddingBottom: styles.paddingBottom,
      paddingLeft: styles.paddingLeft,
      fontSize: styles.fontSize,
      lineHeight: styles.lineHeight,
      fontFamily: styles.fontFamily,
    });
  }, [textareaRef]);

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
        overflowX: 'hidden',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          transform: `translateY(${-scrollTop}px)`,
          padding: computedStyles
            ? `${computedStyles.paddingTop} ${computedStyles.paddingRight} ${computedStyles.paddingBottom} ${computedStyles.paddingLeft}`
            : '4px 6px',
          fontSize: computedStyles?.fontSize || '0.875rem',
          lineHeight: computedStyles?.lineHeight || '1.5',
          fontFamily: computedStyles?.fontFamily || 'inherit',
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
          overflowWrap: 'break-word',
          boxSizing: 'border-box',
          width: '100%',
          textAlign: 'left',
          // Render all text visibly with normal foreground color
          color: 'var(--vscode-input-foreground)',
        }}
      >
        {segments.map((segment, index) => {
          // Mentions get blue text color, regular text inherits parent color
          const style: React.CSSProperties | undefined = segment.isMention
            ? { color: '#3794ff' }
            : undefined;

          return (
            <span key={index} style={style}>
              {segment.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}
