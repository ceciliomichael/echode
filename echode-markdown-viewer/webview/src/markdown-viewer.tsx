import { useEffect, useState } from 'react';
import { MarkdownRenderer } from './markdown-renderer';

interface ViewerMessage {
  type?: unknown;
  content?: unknown;
}

export function MarkdownViewer() {
  const bootstrap = window.__ECHODE_MARKDOWN__;
  const [content, setContent] = useState(bootstrap.content || '');
  const [themeRevision, setThemeRevision] = useState(0);

  useEffect(() => {
    const saved = window.vscode.getState();
    const savedScrollTop = saved && typeof saved === 'object' && 'scrollTop' in saved
      ? Number((saved as { scrollTop?: unknown }).scrollTop)
      : 0;
    const container = document.getElementById('markdown-scroll-container');
    if (container && Number.isFinite(savedScrollTop)) container.scrollTop = savedScrollTop;

    const persistState = () => {
      window.vscode.setState({ documentUri: bootstrap.documentUri, scrollTop: container?.scrollTop || 0 });
    };
    const handleMessage = (event: MessageEvent<ViewerMessage>) => {
      if (event.data.type === 'updateContent' && typeof event.data.content === 'string') {
        setContent(event.data.content);
      } else if (event.data.type === 'themeChanged') {
        setThemeRevision((revision) => revision + 1);
      }
    };

    persistState();
    container?.addEventListener('scroll', persistState, { passive: true });
    window.addEventListener('message', handleMessage);
    return () => {
      container?.removeEventListener('scroll', persistState);
      window.removeEventListener('message', handleMessage);
    };
  }, [bootstrap.documentUri]);

  return (
    <main id="markdown-scroll-container" className="h-screen overflow-auto viewer-surface">
      <article className="max-w-4xl mx-auto px-6 py-8 viewer-content" aria-label={`${bootstrap.docType}: ${bootstrap.title}`}>
        {content ? <MarkdownRenderer content={content} themeRevision={themeRevision} /> : <p className="empty-state">No Markdown content available.</p>}
      </article>
    </main>
  );
}
