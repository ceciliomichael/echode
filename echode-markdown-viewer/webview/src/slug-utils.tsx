import { isValidElement, type ReactElement, type ReactNode } from 'react';

export function extractTextFromChildren(children: ReactNode): string {
  if (children === null || children === undefined) return '';
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(extractTextFromChildren).join('');
  if (isValidElement(children)) {
    return extractTextFromChildren((children as ReactElement<{ children?: ReactNode }>).props.children);
  }
  return '';
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '');
}
