import { memo } from 'react';
import { MarkdownRenderer } from './markdown-renderer';

interface StableMarkdownProps {
  content: string;
}

/**
 * Memoized markdown renderer that only re-renders when content changes
 * Prevents unnecessary re-renders during streaming
 */
export const StableMarkdown = memo(
  function StableMarkdown({ content }: StableMarkdownProps) {
    return <MarkdownRenderer content={content} />;
  },
  (prev, next) => prev.content === next.content
);
