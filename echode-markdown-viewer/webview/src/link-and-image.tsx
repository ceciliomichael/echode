import { type AnchorHTMLAttributes, type ImgHTMLAttributes, type MouseEvent } from 'react';
import { slugify } from './slug-utils';

export function MarkdownLink({ href, children, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const internal = typeof href === 'string' && href.startsWith('#');

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!href) return;
    event.preventDefault();
    event.stopPropagation();

    if (internal) {
      let decoded = href.slice(1);
      try { decoded = decodeURIComponent(decoded); } catch { /* use the raw fragment */ }
      const target = document.getElementById(slugify(decoded));
      const container = document.getElementById('markdown-scroll-container');
      if (target && container) {
        const containerRect = container.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const top = container.scrollTop + targetRect.top - containerRect.top - containerRect.height * 0.3;
        container.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
      }
    } else {
      window.vscode.postMessage({ type: 'openLink', href });
    }
    onClick?.(event);
  };

  return (
    <a
      className="underline decoration-1 underline-offset-2 cursor-pointer markdown-link"
      href={href}
      onClick={handleClick}
      {...props}
    >
      {children}
    </a>
  );
}

export function MarkdownImage({ src, alt, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  let resolvedSource = src;
  if (src && !/^(https?:|data:|vscode-webview:)/i.test(src) && window.__ECHODE_MARKDOWN__.documentBaseUri) {
    try {
      resolvedSource = new URL(src, window.__ECHODE_MARKDOWN__.documentBaseUri).toString();
    } catch {
      resolvedSource = src;
    }
  }

  return <img className="markdown-image" src={resolvedSource} alt={alt || ''} loading="lazy" {...props} />;
}
