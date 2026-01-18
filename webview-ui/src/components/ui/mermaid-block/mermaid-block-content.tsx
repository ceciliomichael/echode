import type { MermaidBlockContentProps } from './types';

/**
 * Loading indicator for generating state
 */
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

/**
 * Placeholder shown while diagram is rendering
 */
const RenderingPlaceholder = () => (
  <div
    className="text-sm py-4"
    style={{ color: 'var(--vscode-descriptionForeground)' }}
  >
    Rendering diagram...
  </div>
);

/**
 * Content component for the MermaidBlock
 * Handles collapsible diagram display with loading states
 */
export const MermaidBlockContent = ({
  isExpanded,
  isGenerating,
  svg,
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