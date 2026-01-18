import { memo, useId } from 'react';
import { useMermaidRenderer } from './use-mermaid-renderer';
import { MERMAID_CONTAINER_STYLES } from './utils';

/**
 * Inline Mermaid diagram renderer
 * Renders mermaid code directly as a diagram without the block header/controls
 */
export const InlineMermaidDiagram = memo(function InlineMermaidDiagram({ code }: { code: string }) {
  const uniqueId = useId().replace(/:/g, '-');
  const { svg } = useMermaidRenderer({
    code,
    uniqueId,
    isGenerating: false,
  });

  if (!svg) {
    return (
      <div
        className="my-4 p-2 rounded-2xl border shadow-sm"
        style={{
          borderColor: 'var(--vscode-widget-border)',
          backgroundColor: 'var(--vscode-editor-background)',
        }}
      >
        {/* Inner Shell */}
        <div
          className="rounded-xl border p-6 flex items-center justify-center"
          style={{
            borderColor: 'var(--vscode-input-border)',
            backgroundColor: 'var(--vscode-editor-background)',
            minHeight: '100px',
          }}
        >
          <div
            className="text-sm"
            style={{ color: 'var(--vscode-descriptionForeground)' }}
          >
            Rendering diagram...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="my-4 p-2 rounded-2xl border shadow-sm"
      style={{
        borderColor: 'var(--vscode-widget-border)',
        backgroundColor: 'var(--vscode-editor-background)',
      }}
    >
      {/* Inner Shell */}
      <div
        className="rounded-xl border p-6 overflow-hidden"
        style={{
          borderColor: 'var(--vscode-input-border)',
          backgroundColor: 'var(--vscode-editor-background)',
        }}
      >
        <div
          className="flex items-center justify-center w-full mermaid-svg-container"
          style={{ minHeight: '100px' }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
      <style>{MERMAID_CONTAINER_STYLES}</style>
    </div>
  );
});