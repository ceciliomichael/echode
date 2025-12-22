import { MarkdownRenderer } from '../markdown-renderer';

interface CompressedBlockContentProps {
  content: string;
  isExpanded: boolean;
}

export function CompressedBlockContent({
  content,
  isExpanded,
}: CompressedBlockContentProps) {
  return (
    <div
      className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-out ${
        isExpanded ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'
      }`}
    >
      <div
        className="border-t"
        style={{ borderColor: 'var(--vscode-input-border)' }}
      >
        <div className="px-3 py-3">
          <div
            className="rounded-lg border overflow-hidden"
            style={{
              borderColor: 'var(--vscode-input-border)',
              backgroundColor: 'var(--vscode-editor-background)',
            }}
          >
            <div 
              className="p-3 overflow-y-auto max-h-[368px]"
              style={{ scrollbarGutter: 'stable' }}
            >
              <div 
                className="prose-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                style={{ color: 'var(--vscode-editor-foreground)' }}
              >
                <MarkdownRenderer content={content} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}