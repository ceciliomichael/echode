import { memo, useEffect, useId, useState, useCallback } from 'react';
import { useClipboard } from '../../../hooks/use-clipboard';
import { MermaidBlockHeader } from './mermaid-block-header';
import { MermaidBlockContent } from './mermaid-block-content';
import { useMermaidRenderer } from './use-mermaid-renderer';
import { MERMAID_CONTAINER_STYLES } from './utils';
import type { MermaidBlockProps } from './types';

const MermaidBlockComponent = ({ code, isGenerating = false }: MermaidBlockProps) => {
  const { copied, copy } = useClipboard();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isOpenInTab, setIsOpenInTab] = useState(false);
  const uniqueId = useId().replace(/:/g, '-');

  const { svg, error } = useMermaidRenderer({
    code,
    uniqueId,
    isGenerating,
  });

  const isReady = !isGenerating && !!svg;
  const handleCopy = useCallback(() => copy(code), [copy, code]);

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

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'mermaidPreviewClosed') {
        if (!message.id || message.id === uniqueId) {
          setIsOpenInTab(false);
          setIsExpanded(true);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [uniqueId]);

  const toggleExpanded = useCallback(() => {
    if (!isOpenInTab) {
      setIsExpanded((prev) => !prev);
    }
  }, [isOpenInTab]);

  return (
    <div
      className="my-2 p-2 rounded-2xl border shadow-sm"
      style={{
        borderColor: 'var(--vscode-widget-border)',
        backgroundColor: 'var(--vscode-editor-background)',
      }}
    >
      <div
        className="rounded-xl border p-4"
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
          error={error}
        />
      </div>
      <style>{MERMAID_CONTAINER_STYLES}</style>
    </div>
  );
};

export const MermaidBlock = memo(MermaidBlockComponent, (prev, next) => {
  return prev.code === next.code && prev.isGenerating === next.isGenerating;
});

export type { MermaidBlockProps } from './types';
