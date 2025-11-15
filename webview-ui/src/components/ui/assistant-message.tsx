import { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { CodeBlock } from './code-block';
import { LoadingDots } from './loading-dots';

interface AssistantMessageProps {
  content: string;
}

const extractCodeContent = (children: React.ReactNode): string => {
  if (children === null || children === undefined) {
    return "";
  }
  if (typeof children === "string") {
    return children;
  }
  if (typeof children === "number" || typeof children === "boolean") {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map((child) => extractCodeContent(child)).join("");
  }
  if (typeof children === "object" && "props" in children) {
    const props = (children as { props?: { children?: React.ReactNode } }).props;
    if (props?.children !== undefined) {
      return extractCodeContent(props.children);
    }
  }
  return "";
};

const StableMarkdown = memo(function StableMarkdown({ content }: { content: string }) {
  const markdownComponents = useMemo(() => ({
    h1: ({ ...props}) => <h1 className="text-base font-bold mt-4 mb-2" style={{ color: 'var(--vscode-editor-foreground)' }} {...props} />,
    h2: ({ ...props }) => <h2 className="text-sm font-bold mt-3 mb-2" style={{ color: 'var(--vscode-editor-foreground)' }} {...props} />,
    h3: ({ ...props }) => <h3 className="text-sm font-bold mt-2 mb-1" style={{ color: 'var(--vscode-editor-foreground)' }} {...props} />,
    h4: ({ ...props }) => <h4 className="text-sm font-bold mt-2 mb-1" style={{ color: 'var(--vscode-editor-foreground)' }} {...props} />,
    h5: ({ ...props }) => <h5 className="text-sm font-bold mt-2 mb-1" style={{ color: 'var(--vscode-editor-foreground)' }} {...props} />,
    h6: ({ ...props }) => <h6 className="text-sm font-bold mt-2 mb-1" style={{ color: 'var(--vscode-editor-foreground)', opacity: 0.8 }} {...props} />,
    p: ({ ...props }) => <p className="mb-3 leading-relaxed text-sm" style={{ color: 'var(--vscode-editor-foreground)' }} {...props} />,
    ul: ({ ...props }) => <ul className="list-disc list-inside mb-3 space-y-1 text-sm" style={{ color: 'var(--vscode-editor-foreground)' }} {...props} />,
    ol: ({ ...props }) => <ol className="list-decimal list-inside mb-3 space-y-1 text-sm" style={{ color: 'var(--vscode-editor-foreground)' }} {...props} />,
    li: ({ ...props }) => <li className="leading-relaxed text-sm" style={{ color: 'var(--vscode-editor-foreground)' }} {...props} />,
    blockquote: ({ ...props }) => (
      <blockquote
        className="border-l-2 pl-3 py-2 mb-3 italic text-sm"
        style={{
          borderColor: 'var(--vscode-button-background)',
          color: 'var(--vscode-editor-foreground)',
          backgroundColor: 'var(--vscode-list-hoverBackground)',
          opacity: 0.8
        }}
        {...props}
      />
    ),
    code: ({ className, children, ...props }: { className?: string; children?: React.ReactNode }) => {
      const isInline = !className;
      return isInline ? (
        <code
          className="rounded px-1.5 py-0.5 text-sm font-mono border"
          style={{
            backgroundColor: 'var(--vscode-input-background)',
            borderColor: 'var(--vscode-input-border)',
            color: 'var(--vscode-button-background)'
          }}
          {...props}
        >
          {children}
        </code>
      ) : (
        <CodeBlock className={className}>
          {children}
        </CodeBlock>
      );
    },
    pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    a: ({ ...props }) => (
      <a
        className="underline hover:opacity-80"
        style={{ color: 'var(--vscode-button-background)' }}
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      />
    ),
    strong: ({ ...props }) => <strong className="font-bold" style={{ color: 'var(--vscode-editor-foreground)' }} {...props} />,
    em: ({ ...props }) => <em className="italic" style={{ color: 'var(--vscode-editor-foreground)' }} {...props} />,
    hr: ({ ...props }) => <hr className="my-4 border-t" style={{ borderColor: 'var(--vscode-input-border)' }} {...props} />,
    table: ({ ...props }) => (
      <div className="overflow-x-auto mb-3">
        <table className="min-w-full border text-sm" style={{ borderColor: 'var(--vscode-input-border)' }} {...props} />
      </div>
    ),
    thead: ({ ...props }) => <thead style={{ backgroundColor: 'var(--vscode-list-hoverBackground)' }} {...props} />,
    tbody: ({ ...props }) => <tbody className="divide-y" style={{ borderColor: 'var(--vscode-input-border)' }} {...props} />,
    tr: ({ ...props }) => <tr {...props} />,
    th: ({ ...props }) => (
      <th
        className="border px-3 py-2 text-left font-bold text-sm"
        style={{
          borderColor: 'var(--vscode-input-border)',
          color: 'var(--vscode-editor-foreground)'
        }}
        {...props}
      />
    ),
    td: ({ ...props }) => (
      <td
        className="border px-3 py-2 text-sm"
        style={{
          borderColor: 'var(--vscode-input-border)',
          color: 'var(--vscode-editor-foreground)'
        }}
        {...props}
      />
    ),
  }), []);

  return (
    <ReactMarkdown components={markdownComponents}>
      {content}
    </ReactMarkdown>
  );
}, (prev, next) => prev.content === next.content);

function AssistantMessageComponent({ content }: AssistantMessageProps) {
  if (!content) {
    return (
      <div className="px-4">
        <div className="px-1 prose prose-sm max-w-none">
          <LoadingDots />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4">
      <div className="px-1 prose prose-sm max-w-none" style={{ color: 'var(--vscode-editor-foreground)' }}>
        <StableMarkdown content={content} />
      </div>
    </div>
  );
}

export const AssistantMessage = memo(AssistantMessageComponent, (prev, next) => {
  return prev.content === next.content;
});