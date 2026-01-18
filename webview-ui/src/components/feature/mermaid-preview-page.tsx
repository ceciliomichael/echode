import { useState, useEffect, useCallback, useRef } from 'react';
import { Check, Copy, Minus, Plus } from 'lucide-react';
import { useMermaidRenderer } from '../ui/mermaid-block/use-mermaid-renderer';
import { MERMAID_CONTAINER_STYLES } from '../ui/mermaid-block/utils';
import { useClipboard } from '../../hooks/use-clipboard';

/**
 * Mermaid icon SVG component
 */
const MermaidIcon = () => (
  <svg
    className="w-3.5 h-3.5"
    viewBox="0 0 24 24"
    fill="currentColor"
    style={{ color: '#FF3670' }}
  >
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);

/**
 * Full-page Mermaid preview component
 * Used when opening a mermaid diagram in a dedicated VS Code tab
 */
export function MermaidPreviewPage() {
  const code = window.mermaidCode || '';
  const id = window.mermaidId || 'preview';
  
  const { copied, copy } = useClipboard();
  const [scale, setScale] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { svg, error } = useMermaidRenderer({
    code,
    uniqueId: `preview-${id}`,
    isGenerating: false,
  });

  // Handle copy
  const handleCopy = useCallback(() => copy(code), [copy, code]);

  // Zoom controls
  const zoomIn = useCallback(() => {
    setScale((prev) => Math.min(5, prev + 0.2));
  }, []);

  const zoomOut = useCallback(() => {
    setScale((prev) => Math.max(0.1, prev - 0.2));
  }, []);

  const resetView = useCallback(() => {
    setScale(1);
    setPanX(0);
    setPanY(0);
  }, []);

  const fitToView = useCallback(() => {
    if (!containerRef.current || !wrapperRef.current) return;
    
    const svgElement = wrapperRef.current.querySelector('svg');
    if (!svgElement) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const svgRect = svgElement.getBoundingClientRect();
    
    // Get original dimensions by dividing by current scale
    const originalWidth = svgRect.width / scale;
    const originalHeight = svgRect.height / scale;
    
    const scaleX = (containerRect.width - 40) / originalWidth;
    const scaleY = (containerRect.height - 40) / originalHeight;
    
    setScale(Math.min(scaleX, scaleY, 2));
    setPanX(0);
    setPanY(0);
  }, [scale]);

  // Save SVG
  const saveSvg = useCallback(() => {
    if (!wrapperRef.current) return;
    const svgElement = wrapperRef.current.querySelector('svg');
    if (svgElement && window.vscode) {
      window.vscode.postMessage({
        type: 'saveMermaidSvg',
        svg: svgElement.outerHTML,
      });
    }
  }, []);

  // Mouse wheel zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setScale((prev) => Math.max(0.1, Math.min(5, prev + delta)));
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // Pan with mouse drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsPanning(true);
    setStartPos({ x: e.clientX - panX, y: e.clientY - panY });
  }, [panX, panY]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isPanning) return;
      setPanX(e.clientX - startPos.x);
      setPanY(e.clientY - startPos.y);
    };

    const handleMouseUp = () => {
      setIsPanning(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPanning, startPos]);

  // Double-click to reset
  const handleDoubleClick = useCallback(() => {
    resetView();
  }, [resetView]);

  // Auto-fit on initial load (only once when SVG first appears)
  const hasFittedRef = useRef(false);
  useEffect(() => {
    if (svg && !hasFittedRef.current) {
      hasFittedRef.current = true;
      // Wait for SVG to be rendered in DOM
      const timer = setTimeout(() => {
        fitToView();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [svg, fitToView]);

  // Notify extension when preview is ready
  useEffect(() => {
    if (svg && window.vscode) {
      window.vscode.postMessage({ type: 'mermaidPreviewReady' });
    }
  }, [svg]);

  // Notify extension when panel is closed
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (window.vscode) {
        window.vscode.postMessage({ 
          type: 'mermaidPreviewClosed',
          id: window.mermaidId,
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  return (
    <div className="h-screen flex flex-col p-4" style={{ backgroundColor: 'var(--vscode-editor-background)' }}>
      {/* Outer Shell */}
      <div
        className="flex-1 flex flex-col p-2 rounded-2xl border overflow-hidden"
        style={{
          borderColor: 'var(--vscode-widget-border)',
          backgroundColor: 'var(--vscode-editor-background)',
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        }}
      >
        {/* Inner Shell */}
        <div
          className="flex-1 flex flex-col p-4 rounded-xl border overflow-hidden"
          style={{
            borderColor: 'var(--vscode-input-border)',
            backgroundColor: 'var(--vscode-editor-background)',
          }}
        >
          {/* Header/Toolbar */}
          <div
            className="flex items-center justify-between pb-4 mb-4 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--vscode-input-border)' }}
          >
            {/* Left: Icon + Filename */}
            <div className="flex items-center gap-2">
              <MermaidIcon />
              <span
                className="text-xs font-mono"
                style={{ color: 'var(--vscode-descriptionForeground)' }}
              >
                mermaid_diagram.mmd
              </span>
            </div>

            {/* Right: Controls */}
            <div className="flex items-center gap-2">
              {/* Zoom controls */}
              <div
                className="flex items-center gap-0.5 px-1 py-0.5 rounded-lg border"
                style={{ borderColor: 'var(--vscode-input-border)' }}
              >
                <button
                  onClick={zoomOut}
                  className="p-1 rounded transition-transform hover:scale-110"
                  style={{ color: 'var(--vscode-foreground)' }}
                  title="Zoom Out"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span
                  className="text-xs min-w-[36px] text-center font-medium"
                  style={{ color: 'var(--vscode-foreground)' }}
                >
                  {Math.round(scale * 100)}%
                </span>
                <button
                  onClick={zoomIn}
                  className="p-1 rounded transition-transform hover:scale-110"
                  style={{ color: 'var(--vscode-foreground)' }}
                  title="Zoom In"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* View controls */}
              <div
                className="flex items-center gap-0.5 px-1 py-0.5 rounded-lg border"
                style={{ borderColor: 'var(--vscode-input-border)' }}
              >
                <button
                  onClick={resetView}
                  className="px-2 py-1 text-xs font-medium rounded transition-transform hover:scale-105"
                  style={{ color: 'var(--vscode-foreground)' }}
                  title="Reset View"
                >
                  Reset
                </button>
                <div
                  className="w-px h-3.5 mx-0.5"
                  style={{ backgroundColor: 'var(--vscode-input-border)' }}
                />
                <button
                  onClick={fitToView}
                  className="px-2 py-1 text-xs font-medium rounded transition-transform hover:scale-105"
                  style={{ color: 'var(--vscode-foreground)' }}
                  title="Fit to View"
                >
                  Fit
                </button>
              </div>

              {/* Action buttons */}
              <div
                className="flex items-center gap-0.5 px-1 py-0.5 rounded-lg border"
                style={{ borderColor: 'var(--vscode-input-border)' }}
              >
                <button
                  onClick={handleCopy}
                  className="p-1 rounded transition-transform hover:scale-110"
                  style={{ color: 'var(--vscode-foreground)' }}
                  title="Copy Code"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={saveSvg}
                  className="px-2 py-1 text-xs font-medium rounded transition-transform hover:scale-105"
                  style={{ color: 'var(--vscode-foreground)' }}
                  title="Save as SVG"
                >
                  Save SVG
                </button>
              </div>
            </div>
          </div>

          {/* Diagram Container */}
          <div
            ref={containerRef}
            className={`flex-1 overflow-hidden relative rounded-lg ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
            style={{ backgroundColor: 'var(--vscode-editor-background)' }}
            onMouseDown={handleMouseDown}
            onDoubleClick={handleDoubleClick}
          >
            <div
              ref={wrapperRef}
              className="absolute left-1/2 top-1/2 transition-transform duration-75 ease-out"
              style={{
                transform: `translate(-50%, -50%) translate(${panX}px, ${panY}px) scale(${scale})`,
                transformOrigin: 'center center',
              }}
            >
              {error ? (
                <div className="flex flex-col items-center justify-center p-4 text-center max-w-lg">
                  <div className="text-red-500 mb-2 font-medium">Failed to render diagram</div>
                  <pre 
                    className="text-xs text-left p-3 rounded overflow-auto max-w-full max-h-[200px]"
                    style={{ 
                      backgroundColor: 'var(--vscode-input-background)',
                      color: 'var(--vscode-errorForeground)',
                      border: '1px solid var(--vscode-input-border)'
                    }}
                  >
                    {error}
                  </pre>
                </div>
              ) : svg ? (
                <div
                  className="mermaid-svg-container"
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
        </div>
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-center gap-2 py-2 text-xs"
        style={{ color: 'var(--vscode-descriptionForeground)' }}
      >
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: '#FF3670', opacity: 0.7 }}
        />
        <span>Scroll to zoom • Drag to pan • Double-click to reset</span>
      </div>
      
      {/* Inject styles for SVG container */}
      <style>{MERMAID_CONTAINER_STYLES}</style>
    </div>
  );
}