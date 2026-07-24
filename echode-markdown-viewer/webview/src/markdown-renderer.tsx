import { memo, useMemo, type CSSProperties, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock, extractCodeContent } from './code-block';
import { MarkdownImage, MarkdownLink } from './link-and-image';
import { MermaidDiagram } from './mermaid-diagram';
import { extractTextFromChildren, slugify } from './slug-utils';

function preprocessTables(content: string): string {
  const lines = content.split('\n');
  const tableLines = new Array<boolean>(lines.length).fill(false);
  let inCodeBlock = false;

  for (let index = 0; index < lines.length; index += 1) {
    let trimmed = lines[index].trim();
    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    while (!inCodeBlock && trimmed.startsWith('>')) trimmed = trimmed.slice(1).trim();
    if (!inCodeBlock && /^[ \t|:-]+$/.test(trimmed) && trimmed.includes('|') && trimmed.includes('-')) {
      tableLines[index] = true;
      for (let before = index - 1; before >= 0 && lines[before].includes('|'); before -= 1) tableLines[before] = true;
      for (let after = index + 1; after < lines.length && lines[after].includes('|'); after += 1) tableLines[after] = true;
    }
  }

  return lines.map((line, index) => tableLines[index]
    ? line.replace(/(`+)([^`]+)\1/g, (_match, ticks: string, value: string) => `${ticks}${value.replace(/(?<!\\)\|/g, '\\|')}${ticks}`)
    : line).join('\n');
}

function Heading({ level, children, ...props }: { level: 1 | 2 | 3 | 4 | 5 | 6; children?: ReactNode }) {
  const Tag = `h${level}` as const;
  const classes = {
    1: 'text-xl font-bold mt-2 mb-4 pb-2 border-b',
    2: 'text-lg font-bold mt-6 mb-3',
    3: 'text-base font-bold mt-4 mb-2',
    4: 'text-sm font-semibold mt-3 mb-2',
    5: 'text-sm font-semibold mt-2 mb-1 opacity-90',
    6: 'text-xs font-semibold mt-2 mb-1 uppercase tracking-wide opacity-70',
  }[level];
  return <Tag id={slugify(extractTextFromChildren(children))} className={classes} {...props}>{children}</Tag>;
}

function createComponents(themeRevision: number): Components {
  return {
    h1: ({ children, ...props }) => <Heading level={1} {...props}>{children}</Heading>,
    h2: ({ children, ...props }) => <Heading level={2} {...props}>{children}</Heading>,
    h3: ({ children, ...props }) => <Heading level={3} {...props}>{children}</Heading>,
    h4: ({ children, ...props }) => <Heading level={4} {...props}>{children}</Heading>,
    h5: ({ children, ...props }) => <Heading level={5} {...props}>{children}</Heading>,
    h6: ({ children, ...props }) => <Heading level={6} {...props}>{children}</Heading>,
    p: (props) => <p className="mb-4 leading-relaxed text-sm break-words" {...props} />,
    ul: (props) => <ul className="list-disc ml-5 mb-4 space-y-2 text-sm" {...props} />,
    ol: (props) => <ol className="list-decimal ml-5 mb-4 space-y-2 text-sm" {...props} />,
    li: (props) => <li className="leading-relaxed text-sm pl-1 break-words" {...props} />,
    blockquote: ({ children, ...props }) => (
      <div className="mb-4">
        <blockquote className="pl-4 py-3 italic text-sm rounded-r markdown-quote" {...props}>{children}</blockquote>
      </div>
    ),
    code: ({ className, children, ...props }) => {
      const text = extractCodeContent(children);
      const inline = !text.includes('\n') && !className;
      if (inline) {
        return <code className="px-1.5 py-0.5 text-xs font-mono border whitespace-pre-wrap break-words inline-code" {...props}>{children}</code>;
      }
      if (className?.includes('language-mermaid')) {
        return <MermaidDiagram code={text.trim()} themeRevision={themeRevision} />;
      }
      return <CodeBlock className={className}>{children}</CodeBlock>;
    },
    pre: ({ children }) => <div className="my-4">{children}</div>,
    a: MarkdownLink,
    img: MarkdownImage,
    strong: (props) => <strong className="font-semibold" {...props} />,
    em: (props) => <em className="italic" {...props} />,
    del: (props) => <del className="line-through opacity-70" {...props} />,
    hr: (props) => <hr className="my-8 border-t markdown-rule" {...props} />,
    table: (props) => <div className="overflow-x-auto my-4 rounded border markdown-table-shell"><table className="w-full text-sm border-collapse" {...props} /></div>,
    thead: (props) => <thead className="markdown-table-head" {...props} />,
    tr: (props) => <tr className="border-b markdown-table-row" {...props} />,
    th: (props) => <th className="px-4 py-2.5 text-left font-semibold text-xs uppercase tracking-wide border-r last:border-r-0 break-words" {...props} />,
    td: (props) => <td className="px-4 py-2.5 text-sm border-r last:border-r-0 break-words" {...props} />,
    input: ({ type, ...props }) => type === 'checkbox'
      ? <input type="checkbox" className="mr-2 align-middle markdown-checkbox" disabled {...props} />
      : <input type={type} {...props} />,
  };
}

export const MarkdownRenderer = memo(function MarkdownRenderer({ content, themeRevision }: { content: string; themeRevision: number }) {
  const processed = useMemo(() => preprocessTables(content), [content]);
  const components = useMemo(() => createComponents(themeRevision), [themeRevision]);
  return <ReactMarkdown components={components} remarkPlugins={[remarkGfm]}>{processed}</ReactMarkdown>;
}, (previous, next) => previous.content === next.content && previous.themeRevision === next.themeRevision);

void ({} as CSSProperties);
