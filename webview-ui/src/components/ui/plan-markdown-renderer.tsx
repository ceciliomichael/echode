import { memo, useMemo, useId } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from './code-block';
import { useMermaidRenderer } from './mermaid-block/use-mermaid-renderer';
import { MERMAID_CONTAINER_STYLES } from './mermaid-block/utils';

interface PlanMarkdownRendererProps {
  content: string;
}

/**
 * Inline Mermaid diagram renderer
 * Renders mermaid code directly as a diagram without the block header/controls
 */
const InlineMermaidDiagram = memo(function InlineMermaidDiagram({ code }: { code: string }) {
  const uniqueId = useId().replace(/:/g, '-');
  const { svg } = useMermaidRenderer({
    code,
    uniqueId,
    isGenerating: false,
  });

  if (!svg) {
    return (
      <div
        className="my-4 p-4 rounded-xl border flex items-center justify-center"
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
    );
  }

  return (
    <div
      className="my-4 p-4 rounded-xl border overflow-hidden"
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
      <style>{MERMAID_CONTAINER_STYLES}</style>
    </div>
  );
});

/**
 * Plan Markdown Renderer
 * Extended markdown renderer with direct Mermaid diagram support.
 * Used for rendering plan documents in the custom Plan Viewer.
 */
export const PlanMarkdownRenderer = memo(function PlanMarkdownRenderer({ content }: PlanMarkdownRendererProps) {
  const markdownComponents = useMemo(() => ({
    h1: ({ ...props }) => (
      <h1 
        className="text-xl font-bold mt-2 mb-4 pb-2 border-b" 
        style={{ 
          color: 'var(--vscode-editor-foreground)',
          borderColor: 'var(--vscode-input-border)'
        }} 
        {...props} 
      />
    ),
    h2: ({ ...props }) => (
      <h2 
        className="text-lg font-bold mt-6 mb-3" 
        style={{ color: 'var(--vscode-editor-foreground)' }} 
        {...props} 
      />
    ),
    h3: ({ ...props }) => (
      <h3 
        className="text-base font-bold mt-4 mb-2" 
        style={{ color: 'var(--vscode-editor-foreground)' }} 
        {...props} 
      />
    ),
    h4: ({ ...props }) => (
      <h4 
        className="text-sm font-semibold mt-3 mb-2" 
        style={{ color: 'var(--vscode-editor-foreground)' }} 
        {...props} 
      />
    ),
    h5: ({ ...props }) => (
      <h5 
        className="text-sm font-semibold mt-2 mb-1" 
        style={{ color: 'var(--vscode-editor-foreground)', opacity: 0.9 }} 
        {...props} 
      />
    ),
    h6: ({ ...props }) => (
      <h6 
        className="text-xs font-semibold mt-2 mb-1 uppercase tracking-wide" 
        style={{ color: 'var(--vscode-editor-foreground)', opacity: 0.7 }} 
        {...props} 
      />
    ),
    p: ({ ...props }) => (
      <p 
        className="mb-4 leading-relaxed text-sm break-words" 
        style={{ color: 'var(--vscode-editor-foreground)' }} 
        {...props} 
      />
    ),
    ul: ({ ...props }) => (
      <ul 
        className="list-disc ml-5 mb-4 space-y-2 text-sm" 
        style={{ color: 'var(--vscode-editor-foreground)' }} 
        {...props} 
      />
    ),
    ol: ({ ...props }) => (
      <ol 
        className="list-decimal ml-5 mb-4 space-y-2 text-sm" 
        style={{ color: 'var(--vscode-editor-foreground)' }} 
        {...props} 
      />
    ),
    li: ({ children, ...props }: { children?: React.ReactNode }) => (
      <li 
        className="leading-relaxed text-sm pl-1 break-words" 
        style={{ color: 'var(--vscode-editor-foreground)' }} 
        {...props}
      >
        {children}
      </li>
    ),
    blockquote: ({ children, ...props }: { children?: React.ReactNode }) => (
      <div className="mb-4">
        <blockquote
          className="border-l-3 pl-4 py-3 italic text-sm rounded-r [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
          style={{
            borderLeftWidth: '3px',
            borderColor: 'var(--vscode-textLink-foreground)',
            color: 'var(--vscode-editor-foreground)',
            backgroundColor: 'var(--vscode-textBlockQuote-background)',
            opacity: 0.95
          }}
          {...props}
        >
          {children}
        </blockquote>
      </div>
    ),
    code: ({ className, children, inline, ...props }: { className?: string; children?: React.ReactNode; inline?: boolean }) => {
      const childrenText = typeof children === 'string' ? children : String(children || '');
      const hasNewlines = childrenText.includes('\n');
      const isInline = inline || (!hasNewlines && !className);

      // Check if this is a mermaid code block
      const isMermaid = className?.includes('language-mermaid');

      if (isInline) {
        return (
          <code
            className="px-1.5 py-0.5 text-xs font-mono border whitespace-pre-wrap break-all"
            style={{
              backgroundColor: 'var(--vscode-textCodeBlock-background)',
              borderColor: 'var(--vscode-input-border)',
              color: 'var(--vscode-textLink-foreground)',
              borderRadius: '4px',
              WebkitBoxDecorationBreak: 'clone',
              boxDecorationBreak: 'clone',
            } as React.CSSProperties}
            {...props}
          >
            {children}
          </code>
        );
      }

      // Render mermaid diagrams directly
      if (isMermaid) {
        return <InlineMermaidDiagram code={childrenText.trim()} />;
      }

      return (
        <CodeBlock className={className}>
          {children}
        </CodeBlock>
      );
    },
    pre: ({ children }: { children?: React.ReactNode }) => (
      <div className="my-4">{children}</div>
    ),
    a: ({ ...props }) => (
      <a
        className="underline decoration-1 underline-offset-2 transition-opacity"
        style={{ color: 'var(--vscode-textLink-foreground)' }}
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      />
    ),
    strong: ({ ...props }) => (
      <strong 
        className="font-semibold" 
        style={{ color: 'var(--vscode-editor-foreground)' }} 
        {...props} 
      />
    ),
    em: ({ ...props }) => (
      <em 
        className="italic" 
        style={{ color: 'var(--vscode-editor-foreground)' }} 
        {...props} 
      />
    ),
    del: ({ ...props }) => (
      <del 
        className="line-through opacity-70" 
        style={{ color: 'var(--vscode-editor-foreground)' }} 
        {...props} 
      />
    ),
    hr: ({ ...props }) => (
      <hr 
        className="my-8 border-t" 
        style={{ borderColor: 'var(--vscode-input-border)' }} 
        {...props} 
      />
    ),
    table: ({ ...props }) => (
      <div className="overflow-x-auto my-4 rounded border" style={{ borderColor: 'var(--vscode-input-border)' }}>
        <table 
          className="w-full text-sm border-collapse" 
          style={{ borderColor: 'var(--vscode-input-border)' }} 
          {...props} 
        />
      </div>
    ),
    thead: ({ ...props }) => (
      <thead 
        style={{ 
          backgroundColor: 'var(--vscode-list-hoverBackground)',
          borderBottomWidth: '2px',
          borderColor: 'var(--vscode-input-border)'
        }} 
        {...props} 
      />
    ),
    tbody: ({ ...props }) => (
      <tbody {...props} />
    ),
    tr: ({ ...props }) => (
      <tr 
        className="border-b transition-colors" 
        style={{ borderColor: 'var(--vscode-input-border)' }}
        {...props} 
      />
    ),
    th: ({ ...props }) => (
      <th
        className="px-4 py-2.5 text-left font-semibold text-xs uppercase tracking-wide border-r last:border-r-0"
        style={{
          color: 'var(--vscode-editor-foreground)',
          borderColor: 'var(--vscode-input-border)'
        }}
        {...props}
      />
    ),
    td: ({ ...props }) => (
      <td
        className="px-4 py-2.5 text-sm border-r last:border-r-0"
        style={{
          color: 'var(--vscode-editor-foreground)',
          borderColor: 'var(--vscode-input-border)'
        }}
        {...props}
      />
    ),
    input: ({ ...props }) => {
      if (props.type === 'checkbox') {
        return (
          <input
            type="checkbox"
            className="mr-2 align-middle"
            disabled
            {...props}
          />
        );
      }
      return <input {...props} />;
    },
  }), []);

  return (
    <ReactMarkdown 
      components={markdownComponents}
      remarkPlugins={[remarkGfm]}
    >
      {content}
    </ReactMarkdown>
  );
}, (prev, next) => prev.content === next.content);