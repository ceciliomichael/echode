import type { MermaidBlockContentProps } from './types';

const GeneratingIndicator = () => (
  <div
    className="flex items-center justify-center gap-2 text-sm py-4"
    style={{ color: 'var(--vscode-descriptionForeground)' }}
  >
    <div className="flex gap-1">
      <span
        className="w-1.5 h-1.5 rounded-full animate-pulse"
        style={{ backgroundColor: 'var(--vscode-foreground)', animationDelay: '0ms' }}
      />
      <span
        className="w-1.5 h-1.5 rounded-full animate-pulse"
        style={{ backgroundColor: 'var(--vscode-foreground)', animationDelay: '150ms' }}
      />
      <span
        className="w-1.5 h-1.5 rounded-full animate-pulse"
        style={{ backgroundColor: 'var(--vscode-foreground)', animationDelay: '300ms' }}
      />
    </div>
    <span>Generating diagram...</span>
  </div>
);

const RenderingPlaceholder = () => (
  <div
    className="text-sm py-4"
    style={{ color: 'var(--vscode-descriptionForeground)' }}
  >
    Rendering diagram...
  </div>
);

export const MermaidBlockContent = ({
  isExpanded,
  isGenerating,
  svg,
  error,
}: MermaidBlockContentProps) => {
  return (
    <div
      className={`overflow-hidden transition-all duration-300 ease-in-out ${
        isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
      }`}
    >
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{
          height: isExpanded ? '300px' : '0',
        }}
      >
        {isGenerating ? (
          <GeneratingIndicator />
        ) : error ? (
          <div className="flex flex-col items-center justify-center p-4 text-center max-w-lg">
            <div className="mb-2 font-medium" style={{ color: 'var(--vscode-errorForeground)' }}>
              Failed to render diagram
            </div>
            <pre
              className="text-xs text-left p-3 rounded overflow-auto max-w-full max-h-[200px]"
              style={{
                backgroundColor: 'var(--vscode-input-background)',
                color: 'var(--vscode-errorForeground)',
                border: '1px solid var(--vscode-input-border)',
              }}
            >
              {error}
            </pre>
          </div>
        ) : svg ? (
          <div
            className="flex items-center justify-center w-full h-full mermaid-svg-container"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <RenderingPlaceholder />
        )}
      </div>
    </div>
  );
};
