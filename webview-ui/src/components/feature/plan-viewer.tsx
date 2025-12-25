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
  const content = window.planContent || '';

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
      className="h-screen overflow-auto"
      style={{ backgroundColor: 'var(--vscode-editor-background)' }}
    >
      <div className="max-w-4xl mx-auto px-6 py-8">
        <PlanMarkdownRenderer content={content} />
      </div>
    </div>
  );
}