import { type MouseEvent } from 'react';
import { slugify } from '../../../utils/slug-utils';
import { vscode } from '../../../utils/vscode';

/**
 * Normalize an anchor href to match our slugified heading IDs.
 * Handles both already-slugified anchors and raw text anchors.
 */
function normalizeAnchorId(href: string): string {
  const rawId = href.startsWith('#') ? href.slice(1) : href;
  // Decode URI components first (e.g., %20 -> space)
  const decoded = decodeURIComponent(rawId);
  // Slugify to match heading ID format
  return slugify(decoded);
}

interface LinkRendererProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  children?: React.ReactNode;
}

/**
 * Custom Link Renderer for Markdown
 * Handles internal anchor links with smooth scrolling centered on the target.
 */
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
          // Manual centering calculation for precision
          const containerRect = scrollContainer.getBoundingClientRect();
          const elementRect = element.getBoundingClientRect();
          const currentScrollTop = scrollContainer.scrollTop;
          
          // Calculate exact position relative to container content
          const elementTopRelativeToContainer = currentScrollTop + (elementRect.top - containerRect.top);
          
          // Position the element at 30% from top instead of centered (50%)
          const targetScrollTop = elementTopRelativeToContainer - (containerRect.height * 0.3) + (elementRect.height / 2);
          
          scrollContainer.scrollTo({
            top: Math.max(0, targetScrollTop),
            behavior: 'auto'
          });
        } else {
          // Fallback if container not found
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