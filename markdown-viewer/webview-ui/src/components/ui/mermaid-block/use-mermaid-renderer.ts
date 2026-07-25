import { useEffect, useState } from 'react';
import mermaid from 'mermaid';
import {
  makeResponsiveSvg,
  createOffscreenContainer,
  removeContainer,
  getMermaidThemeConfig,
  fixMermaidCode,
} from './utils';
import type { MermaidParseResult } from './types';

mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  securityLevel: 'loose',
});

interface UseMermaidRendererOptions {
  code: string;
  uniqueId: string;
  isGenerating: boolean;
}

interface UseMermaidRendererResult {
  svg: string;
  error: string | null;
}

function getParseErrorMessage(parseResult: MermaidParseResult | false): string {
  if (parseResult === false) {
    return 'Invalid Mermaid syntax.';
  }
  if (parseResult.error?.message) {
    return parseResult.error.message;
  }
  return 'Invalid Mermaid syntax.';
}

export const useMermaidRenderer = ({
  code,
  uniqueId,
  isGenerating,
}: UseMermaidRendererOptions): UseMermaidRendererResult => {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isGenerating) {
      return;
    }

    let cancelled = false;

    const renderDiagram = async () => {
      const trimmed = fixMermaidCode(code.trim());
      if (!trimmed) {
        if (!cancelled) {
          setSvg('');
          setError(null);
        }
        return;
      }

      const container = createOffscreenContainer();
      document.body.appendChild(container);

      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let timedOut = false;
      try {
        const timeoutPromise = new Promise<never>((_resolve, reject) => {
          timeoutId = setTimeout(() => {
            timedOut = true;
            reject(new Error('Mermaid render timed out. Check the webview console for blocked chunk/worker requests.'));
          }, 8000);
        });

        await Promise.race([
          (async () => {
            const parseResult = await mermaid.parse(trimmed, { suppressErrors: true }) as MermaidParseResult | false;
            if (parseResult === false || parseResult.success === false) {
              if (!cancelled) {
                setSvg('');
                setError(isGenerating ? null : getParseErrorMessage(parseResult));
              }
              return;
            }

            if (cancelled || timedOut) {
              return;
            }

            const themeConfig = getMermaidThemeConfig();
            mermaid.initialize({
              startOnLoad: false,
              theme: 'base',
              securityLevel: 'loose',
              themeVariables: themeConfig,
            });

            const { svg: renderedSvg } = await mermaid.render(
              `mermaid-${uniqueId}`,
              trimmed,
              container
            );

            if (cancelled || timedOut) {
              return;
            }

            const responsiveSvg = makeResponsiveSvg(renderedSvg);
            setSvg(responsiveSvg);
            setError(null);
          })(),
          timeoutPromise,
        ]);
      } catch (error) {
        if (!cancelled) {
          console.error('[MermaidRenderer] Failed to render diagram:', error);
          setSvg('');
          setError(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        removeContainer(container);
      }
    };

    renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [code, uniqueId, isGenerating]);

  return { svg, error };
};
