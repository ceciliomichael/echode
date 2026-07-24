import mermaid from 'mermaid';
import { memo, useEffect, useId, useState } from 'react';

mermaid.initialize({ startOnLoad: false, theme: 'base', securityLevel: 'strict' });

function cssVariable(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function isDarkBackground(color: string): boolean {
  const match = color.match(/rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)/i);
  if (match) {
    return (Number(match[1]) * 299 + Number(match[2]) * 587 + Number(match[3]) * 114) / 1000 < 128;
  }
  const hex = color.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  if (!hex) return true;
  return (parseInt(hex[1], 16) * 299 + parseInt(hex[2], 16) * 587 + parseInt(hex[3], 16) * 114) / 1000 < 128;
}

function themeVariables() {
  const background = cssVariable('--vscode-editor-background', '#1e1e1e');
  const dark = isDarkBackground(background);
  return dark
    ? {
        primaryColor: '#3b82f6', primaryTextColor: '#ffffff', primaryBorderColor: '#60a5fa',
        lineColor: '#9ca3af', secondaryColor: '#8b5cf6', tertiaryColor: '#ec4899', background,
        mainBkg: '#2d2d2d', secondaryBkg: '#3b82f6', tertiaryBkg: '#8b5cf6', nodeBorder: '#9ca3af',
        clusterBkg: '#2d2d2d', clusterBorder: '#9ca3af', titleColor: '#ffffff', edgeLabelBackground: '#2d2d2d',
        textColor: '#e5e7eb', edgeLabelColor: '#e5e7eb', noteBkgColor: '#2d2d2d', noteBorderColor: '#666666',
        noteTextColor: '#e5e7eb', labelBoxBkgColor: '#2d2d2d', labelBoxBorderColor: '#666666',
        labelTextColor: '#e5e7eb', loopTextColor: '#e5e7eb', activationBorderColor: '#666666',
        activationBkgColor: '#2d2d2d', actorBkg: background, actorBorder: '#666666', actorTextColor: '#e5e7eb',
        actorLineColor: '#666666', signalColor: '#e5e7eb', signalTextColor: '#e5e7eb', box1BkgColor: '#2d2d2d',
        box2BkgColor: '#3a3a3a', boxBorderColor: '#666666', boxTextColor: '#e5e7eb',
      }
    : {
        primaryColor: '#2563eb', primaryTextColor: '#1f2937', primaryBorderColor: '#3b82f6',
        lineColor: '#6b7280', secondaryColor: '#7c3aed', tertiaryColor: '#db2777', background,
        mainBkg: '#f3f4f6', secondaryBkg: '#3b82f6', tertiaryBkg: '#7c3aed', nodeBorder: '#9ca3af',
        clusterBkg: '#f3f4f6', clusterBorder: '#9ca3af', titleColor: '#1f2937', edgeLabelBackground: '#f3f4f6',
        textColor: '#1f2937', edgeLabelColor: '#1f2937', noteBkgColor: '#e5e7eb', noteBorderColor: '#9ca3af',
        noteTextColor: '#1f2937', labelBoxBkgColor: '#e5e7eb', labelBoxBorderColor: '#9ca3af',
        labelTextColor: '#1f2937', loopTextColor: '#1f2937', activationBorderColor: '#9ca3af',
        activationBkgColor: '#f3f4f6', actorBkg: background, actorBorder: '#9ca3af', actorTextColor: '#1f2937',
        actorLineColor: '#6b7280', signalColor: '#1f2937', signalTextColor: '#1f2937', box1BkgColor: '#f3f4f6',
        box2BkgColor: '#e5e7eb', boxBorderColor: '#9ca3af', boxTextColor: '#1f2937',
      };
}

function fixMermaidCode(code: string): string {
  return code
    .replace(/^[ \t]*style\s+\S+\s+fill:[^\r\n]*$/gm, '')
    .replace(/([a-zA-Z0-9_-]+)(\s*)\[\s*(?!(?:"|[[(/\\]))([^\r\n\]]*?)\s*\]/g, '$1$2["$3"]')
    .replace(/\.\.\|>/g, '-.->');
}

function makeResponsive(svg: string): string {
  return svg
    .replace(/width="100%"/i, 'width="100%"')
    .replace(/<svg([^>]*)>/i, '<svg$1 preserveAspectRatio="xMidYMid meet">');
}

export const MermaidDiagram = memo(function MermaidDiagram({ code, themeRevision }: { code: string; themeRevision: number }) {
  const uniqueId = useId().replace(/:/g, '-');
  const [svg, setSvg] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const container = document.createElement('div');
    container.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:2000px;height:2000px;overflow:hidden;opacity:0;pointer-events:none';
    document.body.appendChild(container);

    const render = async () => {
      try {
        const source = fixMermaidCode(code.trim());
        const parsed = await mermaid.parse(source, { suppressErrors: true });
        if (!parsed) throw new Error('Invalid Mermaid syntax.');
        mermaid.initialize({ startOnLoad: false, theme: 'base', securityLevel: 'strict', themeVariables: themeVariables() });
        const result = await mermaid.render(`echode-mermaid-${uniqueId}-${themeRevision}`, source, container);
        if (!cancelled) {
          setSvg(makeResponsive(result.svg));
          setError(null);
        }
      } catch (reason) {
        if (!cancelled) {
          setSvg('');
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      } finally {
        container.remove();
      }
    };

    void render();
    return () => {
      cancelled = true;
      container.remove();
    };
  }, [code, themeRevision, uniqueId]);

  return (
    <div className="my-4 p-2 rounded-2xl border mermaid-shell">
      <div className="rounded-xl border p-6 flex items-center justify-center overflow-auto mermaid-inner">
        {error ? (
          <div className="w-full max-w-lg">
            <div className="text-sm font-medium mb-2 mermaid-error-title">Failed to render diagram</div>
            <pre className="text-xs p-3 rounded overflow-auto mermaid-error">{error}</pre>
          </div>
        ) : svg ? (
          <div className="mermaid-svg-container" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <div className="text-sm muted">Rendering diagram...</div>
        )}
      </div>
    </div>
  );
});
