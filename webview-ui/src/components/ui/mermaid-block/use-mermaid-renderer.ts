import { useEffect, useState } from 'react';
import mermaid from 'mermaid';
import {
  makeResponsiveSvg,
  createOffscreenContainer,
  removeContainer,
} from './utils';

// Initialize mermaid with base config (theme will be set per-render)
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
});

interface UseMermaidRendererOptions {
  code: string;
  uniqueId: string;
  isGenerating: boolean;
}

interface UseMermaidRendererResult {
  svg: string;
}

/**
 * Custom hook for rendering mermaid diagrams
 * Handles async rendering, theme integration, and cleanup
 */
export const useMermaidRenderer = ({
  code,
  uniqueId,
  isGenerating,
}: UseMermaidRendererOptions): UseMermaidRendererResult => {
  const [svg, setSvg] = useState<string>('');

  useEffect(() => {
    // Don't render while generating - wait for complete code
    if (isGenerating) {
      return;
    }

    let cancelled = false;

    const renderDiagram = async () => {
      const trimmed = code.trim();
      if (!trimmed) {
        if (!cancelled) {
          setSvg('');
        }
        return;
      }

      // Create an offscreen sandbox container so mermaid can never inject
      // error SVGs or temporary nodes into the visible document/body.
      const container = createOffscreenContainer();
      document.body.appendChild(container);

      try {
        // First, validate syntax only. If Mermaid considers this invalid, skip rendering entirely
        // so that its internal error renderer is never invoked.
        const parseResult = await mermaid.parse(trimmed, { suppressErrors: true });
        if (parseResult === false) {
          if (!cancelled) {
            setSvg('');
          }
          return;
        }

        // Use Mermaid's built-in dark theme (same as preview)
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          securityLevel: 'loose',
        });

        const { svg: renderedSvg } = await mermaid.render(
          `mermaid-${uniqueId}`,
          trimmed,
          container
        );

        if (cancelled) {
          return;
        }

        // Post-process SVG to make it responsive
        const responsiveSvg = makeResponsiveSvg(renderedSvg);
        setSvg(responsiveSvg);
      } catch {
        if (!cancelled) {
          // Swallow mermaid errors; just don't render a diagram
          setSvg('');
        }
      } finally {
        // Always remove the sandbox container so no stray nodes remain
        removeContainer(container);
      }
    };

    renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [code, uniqueId, isGenerating]);

  return { svg };
};