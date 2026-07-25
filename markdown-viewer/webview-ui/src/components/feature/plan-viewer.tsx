import { useState, useEffect } from 'react';
import { PlanMarkdownRenderer } from '../ui/plan-markdown-renderer';

declare global {
  interface Window {
    planContent?: string;
  }
}

/**
 * Plan Viewer Component
 * Displays plan content with full markdown support including Mermaid diagrams.
 * Used in the custom Plan Viewer webview panel.
 */
export function PlanViewer() {
  const normalizePlanViewerContent = (value: string): string => {
    const hasEscapedNewline = value.includes('\\n') || value.includes('\\r\\n');
    if (hasEscapedNewline) {
      return value.replace(/\\r\\n/g, '\r\n').replace(/\\n/g, '\n');
    }
    return value;
  };

  const [content, setContent] = useState(() => normalizePlanViewerContent(window.planContent || ''));

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'updatePlanContent' && typeof message.content === 'string') {
        setContent(normalizePlanViewerContent(message.content));
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  if (!content) {
    return (
      <div 
        className="h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--vscode-editor-background)' }}
      >
        <div 
          className="text-sm"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          No plan content available.
        </div>
      </div>
    );
  }

  return (
    <div 
      id="plan-scroll-container"
      className="h-screen overflow-auto"
      style={{ backgroundColor: 'var(--vscode-editor-background)' }}
    >
      <div className="max-w-4xl mx-auto px-6 py-8">
        <PlanMarkdownRenderer content={content} />
      </div>
    </div>
  );
}
