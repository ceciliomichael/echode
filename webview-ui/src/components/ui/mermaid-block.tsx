import { memo, useEffect, useId, useState, useCallback } from 'react';
import mermaid from 'mermaid';
import { Check, Copy, AlertCircle, Maximize2, ChevronDown, ChevronRight } from 'lucide-react';
import { useClipboard } from '../../hooks/use-clipboard';

interface MermaidBlockProps {
  code: string;
  isGenerating?: boolean;
}

// Helper to get computed CSS variable value
const getCssVar = (varName: string, fallback: string): string => {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return value || fallback;
};

// Initialize mermaid with base config (theme will be set per-render)
mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  securityLevel: 'loose',
});

const MermaidBlockComponent = ({ code, isGenerating = false }: MermaidBlockProps) => {
  const { copied, copy } = useClipboard();
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOpenInTab, setIsOpenInTab] = useState(false);
  const uniqueId = useId().replace(/:/g, '-');

  useEffect(() => {
    // Don't render while generating - wait for complete code
    if (isGenerating) {
      return;
    }

    const renderDiagram = async () => {
      try {
        setError(null);
        
        // Get computed colors from CSS variables for mermaid theming
        const bgColor = getCssVar('--vscode-editor-background', '#1e1e1e');
        const fgColor = getCssVar('--vscode-foreground', '#cccccc');
        const primaryColor = getCssVar('--vscode-button-background', '#0e639c');
        const borderColor = getCssVar('--vscode-input-border', '#3c3c3c');
        
        // Re-initialize with computed theme colors before each render
        mermaid.initialize({
          startOnLoad: false,
          theme: 'base',
          securityLevel: 'loose',
          themeVariables: {
            primaryColor: primaryColor,
            primaryTextColor: fgColor,
            primaryBorderColor: borderColor,
            lineColor: fgColor,
            secondaryColor: bgColor,
            tertiaryColor: bgColor,
            background: bgColor,
            mainBkg: bgColor,
            nodeBorder: borderColor,
            clusterBkg: bgColor,
            clusterBorder: borderColor,
            titleColor: fgColor,
            edgeLabelBackground: bgColor,
            textColor: fgColor,
            edgeLabelColor: fgColor,
            noteBkgColor: bgColor,
            noteBorderColor: borderColor,
          },
        });
        
        const { svg: renderedSvg } = await mermaid.render(`mermaid-${uniqueId}`, code.trim());
        
        // Post-process SVG to make it responsive (remove hardcoded width/height)
        // This ensures it fits within the container while preserving aspect ratio via viewBox
        const responsiveSvg = renderedSvg
          .replace(/width="[^"]*"/, '')
          .replace(/height="[^"]*"/, '')
          .replace(/style="[^"]*"/, 'style="max-width: 100%; max-height: 100%;"');

        setSvg(responsiveSvg);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
        setSvg('');
      }
    };

    if (code.trim()) {
      renderDiagram();
    }
  }, [code, uniqueId, isGenerating]);

  const handleCopy = () => copy(code);

  const handleOpenInTab = useCallback(() => {
    if (window.vscode) {
      window.vscode.postMessage({
        type: 'openMermaidPreview',
        text: code,
        id: uniqueId // Send ID to track specific tab
      });
      setIsExpanded(false);
      setIsOpenInTab(true);
    }
  }, [code, uniqueId]);

  // Listen for preview panel close event
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'mermaidPreviewClosed') {
        // Only respond if the closed panel matches our ID (or if no ID provided for legacy support)
        if (!message.id || message.id === uniqueId) {
          setIsOpenInTab(false);
          // Keep diagram collapsed when preview tab closes
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [uniqueId]);

  const toggleExpanded = useCallback(() => {
    if (!isOpenInTab) {
      setIsExpanded(prev => !prev);
    }
  }, [isOpenInTab]);

  return (
    <div
      className="my-2 rounded-xl overflow-hidden border"
      style={{
        borderColor: 'var(--vscode-input-border)',
        backgroundColor: 'var(--vscode-editor-background)',
      }}
    >
      {/* Header - Clickable to toggle */}
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer select-none"
        style={{
          borderColor: 'var(--vscode-input-border)',
          backgroundColor: 'var(--vscode-editor-background)',
          color: 'var(--vscode-descriptionForeground)',
        }}
        onClick={toggleExpanded}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--vscode-foreground)', opacity: 0.6 }} />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--vscode-foreground)', opacity: 0.6 }} />
          )}
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="currentColor"
            style={{ color: '#FF3670' }}
          >
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          <span
            className="text-xs font-medium"
            style={{ color: 'var(--vscode-foreground)', opacity: 0.7 }}
          >
            Mermaid Diagram{isOpenInTab ? ' (Open in Tab)' : ''}
          </span>
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center py-1 px-1 rounded transition-colors"
            style={{ color: 'var(--vscode-foreground)', outline: 'none' }}
            title="Copy code"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 hover:scale-110 transition-transform" />
            ) : (
              <Copy className="w-3.5 h-3.5 hover:scale-110 transition-transform" />
            )}
          </button>
          <button
            type="button"
            onClick={handleOpenInTab}
            className="flex items-center py-1 px-1 rounded transition-colors"
            style={{ color: 'var(--vscode-foreground)', outline: 'none' }}
            title="Open in new tab"
          >
            <Maximize2 className="w-3.5 h-3.5 hover:scale-110 transition-transform" />
          </button>
        </div>
      </div>

      {/* Content - Collapsible diagram container */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div
          className="p-4 flex items-center justify-center overflow-hidden border-t"
          style={{ 
            backgroundColor: 'var(--vscode-editor-background)',
            borderColor: 'var(--vscode-input-border)',
            height: isExpanded ? '300px' : '0',
          }}
        >
        {isGenerating ? (
          <div
            className="flex items-center justify-center gap-2 text-sm py-4"
            style={{ color: 'var(--vscode-descriptionForeground)' }}
          >
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--vscode-foreground)', animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--vscode-foreground)', animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--vscode-foreground)', animationDelay: '300ms' }} />
            </div>
            <span>Generating diagram...</span>
          </div>
        ) : error ? (
          <div
            className="flex items-center gap-2 text-sm p-3 rounded"
            style={{
              color: 'var(--vscode-errorForeground)',
              backgroundColor: 'var(--vscode-inputValidation-errorBackground)',
            }}
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : svg ? (
          <div
            className="flex items-center justify-center w-full h-full mermaid-svg-container"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div
            className="text-sm py-4"
            style={{ color: 'var(--vscode-descriptionForeground)' }}
          >
            Rendering diagram...
          </div>
        )}
        </div>
      </div>
      {/* Inject styles for SVG container */}
      <style>{`
        .mermaid-svg-container {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .mermaid-svg-container svg {
          max-width: 100%;
          max-height: 100%;
          width: auto;
          height: auto;
          display: block;
          object-fit: contain;
        }
      `}</style>
    </div>
  );
};

export const MermaidBlock = memo(MermaidBlockComponent, (prev, next) => {
  return prev.code === next.code && prev.isGenerating === next.isGenerating;
});
