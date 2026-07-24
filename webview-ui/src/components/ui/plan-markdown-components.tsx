import { useMemo, type ReactNode } from 'react';
import { slugify, extractTextFromChildren } from '../../utils/slug-utils';
import { CodeBlock, extractCodeContent } from './code-block';
import { InlineMermaidDiagram } from './mermaid-block/inline-mermaid-diagram';
import { LinkRenderer } from './markdown/link-renderer';

export function usePlanMarkdownComponents() {
  return useMemo(() => ({
    h1: ({ children, ...props }: { children?: ReactNode }) => (
      <h1 
        id={slugify(extractTextFromChildren(children))}
        className="text-xl font-bold mt-2 mb-4 pb-2 border-b" 
        style={{ 
          color: 'var(--vscode-editor-foreground)',
          borderColor: 'var(--vscode-input-border)'
        }} 
        {...props} 
      >
        {children}
      </h1>
    ),
    h2: ({ children, ...props }: { children?: ReactNode }) => (
      <h2 
        id={slugify(extractTextFromChildren(children))}
        className="text-lg font-bold mt-6 mb-3" 
        style={{ color: 'var(--vscode-editor-foreground)' }} 
        {...props} 
      >
        {children}
      </h2>
    ),
    h3: ({ children, ...props }: { children?: ReactNode }) => (
      <h3 
        id={slugify(extractTextFromChildren(children))}
        className="text-base font-bold mt-4 mb-2" 
        style={{ color: 'var(--vscode-editor-foreground)' }} 
        {...props} 
      >
        {children}
      </h3>
    ),
    h4: ({ children, ...props }: { children?: ReactNode }) => (
      <h4 
        id={slugify(extractTextFromChildren(children))}
        className="text-sm font-semibold mt-3 mb-2" 
        style={{ color: 'var(--vscode-editor-foreground)' }} 
        {...props} 
      >
        {children}
      </h4>
    ),
    h5: ({ children, ...props }: { children?: ReactNode }) => (
      <h5 
        id={slugify(extractTextFromChildren(children))}
        className="text-sm font-semibold mt-2 mb-1" 
        style={{ color: 'var(--vscode-editor-foreground)', opacity: 0.9 }} 
        {...props} 
      >
        {children}
      </h5>
    ),
    h6: ({ children, ...props }: { children?: ReactNode }) => (
      <h6 
        id={slugify(extractTextFromChildren(children))}
        className="text-xs font-semibold mt-2 mb-1 uppercase tracking-wide" 
        style={{ color: 'var(--vscode-editor-foreground)', opacity: 0.7 }} 
        {...props} 
      >
        {children}
      </h6>
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
    li: ({ children, ...props }: { children?: ReactNode }) => (
      <li 
        className="leading-relaxed text-sm pl-1 break-words" 
        style={{ color: 'var(--vscode-editor-foreground)' }} 
        {...props}
      >
        {children}
      </li>
    ),
    blockquote: ({ children, ...props }: { children?: ReactNode }) => (
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
    code: ({ className, children, inline, ...props }: { className?: string; children?: ReactNode; inline?: boolean }) => {
      const childrenText = extractCodeContent(children);
      const hasNewlines = childrenText.includes('\n');
      const isInline = inline || (!hasNewlines && !className);

      // Check if this is a mermaid code block
      const isMermaid = className?.includes('language-mermaid');

      if (isInline) {
        return (
          <code
            className="px-1.5 py-0.5 text-xs font-mono border whitespace-pre-wrap break-words"
            style={{
              backgroundColor: 'var(--vscode-textCodeBlock-background)',
              borderColor: 'var(--vscode-input-border)',
              color: 'var(--vscode-textLink-foreground)',
              borderRadius: '4px',
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
    pre: ({ children }: { children?: ReactNode }) => (
      <div className="my-4">{children}</div>
    ),
    a: LinkRenderer,
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
        className="px-4 py-2.5 text-left font-semibold text-xs uppercase tracking-wide border-r last:border-r-0 break-words"
        style={{
          color: 'var(--vscode-editor-foreground)',
          borderColor: 'var(--vscode-input-border)'
        }}
        {...props}
      />
    ),
    td: ({ ...props }) => (
      <td
        className="px-4 py-2.5 text-sm border-r last:border-r-0 break-words"
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
}