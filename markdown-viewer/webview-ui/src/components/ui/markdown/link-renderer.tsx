import { type MouseEvent } from 'react';
import { slugify } from '../../../utils/slug-utils';
import { vscode } from '../../../utils/vscode';

function normalizeAnchorId(href: string): string {
  const rawId = href.startsWith('#') ? href.slice(1) : href;
  const decoded = decodeURIComponent(rawId);
  return slugify(decoded);
}

interface LinkRendererProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  children?: React.ReactNode;
}

export function LinkRenderer({ href, onClick, children, ...props }: LinkRendererProps) {
  const isInternal = typeof href === 'string' && href.startsWith('#');

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (isInternal && href) {
      e.preventDefault();
      e.stopPropagation();
      
      const id = normalizeAnchorId(href);
      const element = document.getElementById(id);
      
      if (element) {
        const scrollContainer = document.getElementById('plan-scroll-container');
        
        if (scrollContainer) {
          const containerRect = scrollContainer.getBoundingClientRect();
          const elementRect = element.getBoundingClientRect();
          const currentScrollTop = scrollContainer.scrollTop;
          
          const elementTopRelativeToContainer = currentScrollTop + (elementRect.top - containerRect.top);
          const targetScrollTop = elementTopRelativeToContainer - (containerRect.height * 0.3) + (elementRect.height / 2);
          
          scrollContainer.scrollTo({
            top: Math.max(0, targetScrollTop),
            behavior: 'auto'
          });
        } else {
          element.scrollIntoView({ 
            behavior: 'auto', 
            block: 'start',
            inline: 'nearest'
          });
        }
      }
    } else if (typeof href === 'string' && !href.startsWith('http') && !href.startsWith('mailto:') && !href.startsWith('#')) {
      e.preventDefault();
      e.stopPropagation();
      vscode.postMessage({
        type: 'openRelativeLink',
        href: href
      });
      return;
    }
    
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <a
      className="underline decoration-1 underline-offset-2 transition-opacity cursor-pointer"
      style={{ color: 'var(--vscode-textLink-foreground)' }}
      target={isInternal ? undefined : "_blank"}
      rel={isInternal ? undefined : "noopener noreferrer"}
      href={href}
      onClick={handleClick}
      {...props}
    >
      {children}
    </a>
  );
}
