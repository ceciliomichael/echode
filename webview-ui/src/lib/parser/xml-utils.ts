/**
 * XML utility functions for escaping/unescaping XML entities
 * Single Responsibility: Handle XML entity transformations
 */

/**
 * Unescape XML entities back to original characters
 * Order matters: &amp; must be last to avoid double-unescaping
 */
export function unescapeXml(text: string): string {
  return text
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

/**
 * Escape special characters to XML entities
 * Order matters: & must be first to avoid double-escaping
 */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
