import { memo, useEffect, useId, useState, useCallback } from 'react';
import { useClipboard } from '../../../hooks/use-clipboard';
import { MermaidBlockHeader } from './mermaid-block-header';
import { MermaidBlockContent } from './mermaid-block-content';
import { useMermaidRenderer } from './use-mermaid-renderer';
import { MERMAID_CONTAINER_STYLES } from './utils';
import type { MermaidBlockProps } from './types';

/**
 * Main MermaidBlock component
 * Renders mermaid diagrams with VS Code theme integration
 */
const MermaidBlockComponent = ({ code, isGenerating = false }: MermaidBlockProps) => {
  const { copied, copy } = useClipboard();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isOpenInTab, setIsOpenInTab] = useState(false);
  const uniqueId = useId().replace(/:/g, '-');

  // Use custom hook for mermaid rendering
  const { svg } = useMermaidRenderer({
    code,
    uniqueId,
    isGenerating,
  });

  // Diagram is ready when not generating and SVG is rendered
  const isReady = !isGenerating && !!svg;

  // Handle copy action
  const handleCopy = useCallback(() => copy(code), [copy, code]);

  // Handle open in new tab action
  const handleOpenInTab = useCallback(() => {
    if (window.vscode) {
      window.vscode.postMessage({
        type: 'openMermaidPreview',
        text: code,
        id: uniqueId,
      });
      setIsExpanded(false);
      setIsOpenInTab(true);
    }
  }, [code, uniqueId]);

  // Listen for preview panel close event
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'mermaidPreviewClosed') {
        // Only respond if the closed panel matches our ID (or if no ID provided for legacy support)
        if (!message.id || message.id === uniqueId) {
          setIsOpenInTab(false);
          // Re-expand diagram in chat when preview tab closes
          setIsExpanded(true);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [uniqueId]);

  // Toggle expanded state
  const toggleExpanded = useCallback(() => {
    if (!isOpenInTab) {
      setIsExpanded((prev) => !prev);
    }
  }, [isOpenInTab]);

  return (
    <div
      className="my-2 rounded-xl overflow-hidden border"
      style={{
        borderColor: 'var(--vscode-input-border)',
        backgroundColor: 'var(--vscode-editor-background)',
      }}
    >
      <MermaidBlockHeader
        isExpanded={isExpanded}
        isOpenInTab={isOpenInTab}
        isReady={isReady}
        copied={copied}
        onToggle={toggleExpanded}
        onCopy={handleCopy}
        onOpenInTab={handleOpenInTab}
      />
      <MermaidBlockContent
        isExpanded={isExpanded}
        isGenerating={isGenerating}
        svg={svg}
      />
      {/* Inject styles for SVG container */}
      <style>{MERMAID_CONTAINER_STYLES}</style>
    </div>
  );
};

/**
 * Memoized MermaidBlock component
 * Only re-renders when code or isGenerating changes
 */
export const MermaidBlock = memo(MermaidBlockComponent, (prev, next) => {
  return prev.code === next.code && prev.isGenerating === next.isGenerating;
});

// Re-export types for external use
export type { MermaidBlockProps } from './types';