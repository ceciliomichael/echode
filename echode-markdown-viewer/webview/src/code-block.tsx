import { Check, Copy, FileCode2 } from 'lucide-react';
import { memo, useMemo, type ReactNode } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useClipboard } from './use-clipboard';

interface CodeBlockProps {
  children?: ReactNode;
  className?: string;
}

export function extractCodeContent(children: ReactNode): string {
  if (children === null || children === undefined) return '';
  if (typeof children === 'string' || typeof children === 'number' || typeof children === 'boolean') {
    return String(children);
  }
  if (Array.isArray(children)) return children.map(extractCodeContent).join('');
  if (typeof children === 'object' && 'props' in children) {
    return extractCodeContent((children as { props?: { children?: ReactNode } }).props?.children);
  }
  return '';
}

const LANGUAGE_LABELS: Record<string, string> = {
  bash: 'Bash', css: 'CSS', html: 'HTML', javascript: 'JavaScript', js: 'JavaScript',
  json: 'JSON', jsx: 'React', markdown: 'Markdown', md: 'Markdown', mermaid: 'Mermaid',
  powershell: 'PowerShell', python: 'Python', py: 'Python', shell: 'Shell', sql: 'SQL',
  ts: 'TypeScript', tsx: 'TypeScript React', typescript: 'TypeScript', xml: 'XML', yaml: 'YAML',
};

function CodeBlockComponent({ children, className }: CodeBlockProps) {
  const { copied, copy } = useClipboard();
  const language = className?.replace('language-', '') || 'text';
  const label = LANGUAGE_LABELS[language.toLowerCase()] || language;
  const codeContent = useMemo(() => extractCodeContent(children), [children]);
  const lines = useMemo(() => codeContent.replace(/\n$/, '').split('\n'), [codeContent]);

  return (
    <div className="my-2 rounded-xl overflow-hidden border min-w-0 max-w-full code-shell">
      <div className="flex items-center justify-between px-3 border-b code-header">
        <div className="flex items-center gap-2 min-w-0">
          <FileCode2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="text-xs font-medium truncate">{label}</span>
        </div>
        <button
          type="button"
          onClick={() => void copy(codeContent)}
          className="copy-button flex items-center justify-center rounded"
          aria-label={copied ? 'Copied code' : 'Copy code'}
          title={copied ? 'Copied' : 'Copy code'}
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      <div className="flex min-w-0 code-body">
        <div className="flex-shrink-0 border-r line-numbers">
          <pre className="text-xs font-mono m-0 py-1">
            <code className="block">
              {lines.map((_, index) => (
                <span key={index} className="select-none px-1.5 text-right block min-h-[1.15rem] leading-[1.15rem]">
                  {index + 1}
                </span>
              ))}
            </code>
          </pre>
        </div>
        <div className="flex-1 overflow-x-auto">
          <SyntaxHighlighter
            language={language}
            style={vscDarkPlus}
            customStyle={{ margin: 0, padding: '0.25rem 1rem 0.25rem 0.5rem', background: 'transparent', fontSize: '0.75rem' }}
            codeTagProps={{ className: 'font-mono block', style: { background: 'transparent' } }}
            wrapLines
            lineProps={{ style: { display: 'block', minHeight: '1.15rem', lineHeight: '1.15rem' } }}
          >
            {codeContent.replace(/\n$/, '')}
          </SyntaxHighlighter>
        </div>
      </div>
    </div>
  );
}

export const CodeBlock = memo(CodeBlockComponent, (previous, next) =>
  previous.className === next.className && extractCodeContent(previous.children) === extractCodeContent(next.children),
);
