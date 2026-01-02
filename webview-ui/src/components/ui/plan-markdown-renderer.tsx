import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { usePlanMarkdownComponents } from './plan-markdown-components';

interface PlanMarkdownRendererProps {
  content: string;
}

/**
 * Plan Markdown Renderer
 * Extended markdown renderer with direct Mermaid diagram support.
 * Used for rendering plan documents in the custom Plan Viewer.
 * 
 * Refactored to use extracted components for better modularity.
 */
export const PlanMarkdownRenderer = memo(function PlanMarkdownRenderer({ content }: PlanMarkdownRendererProps) {
  const markdownComponents = usePlanMarkdownComponents();

  return (
    <ReactMarkdown 
      components={markdownComponents}
      remarkPlugins={[remarkGfm]}
    >
      {content}
    </ReactMarkdown>
  );
}, (prev, next) => prev.content === next.content);