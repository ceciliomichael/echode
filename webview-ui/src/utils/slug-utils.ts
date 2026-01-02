import { isValidElement, type ReactNode, type ReactElement } from 'react';

/**
 * Extract plain text from React children.
 * Recursively traverses arrays and React elements to build a single string.
 */
export function extractTextFromChildren(children: ReactNode): string {
  if (!children) return '';
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  
  if (Array.isArray(children)) {
    return children.map(extractTextFromChildren).join('');
  }

  if (isValidElement(children)) {
    const element = children as ReactElement<{ children?: ReactNode }>;
    if (element.props) {
      return extractTextFromChildren(element.props.children);
    }
  }

  return '';
}

/**
 * Convert text to a URL-friendly slug.
 * Example: "System Overview" -> "system-overview"
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')     // Replace spaces with -
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-')   // Replace multiple - with single -
    .replace(/^-+/, '')       // Trim - from start of text
    .replace(/-+$/, '');      // Trim - from end of text
}