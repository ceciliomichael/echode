import { Cable } from 'lucide-react';
import { MarkdownRenderer } from '../markdown-renderer';

interface McpToolResultProps {
  toolName: string;
  data: unknown;
}

/**
 * Detects if content appears to be markdown rather than plain text/JSON
 */
function isMarkdownContent(content: string): boolean {
  // Check for common markdown patterns
  const markdownPatterns = [
    /^#{1,6}\s+/m,           // Headers: # Header
    /\*\*[^*]+\*\*/,         // Bold: **text**
    /\*[^*]+\*/,             // Italic: *text*
    /^[-*+]\s+/m,            // Unordered lists: - item
    /^\d+\.\s+/m,            // Ordered lists: 1. item
    /\[([^\]]+)\]\([^)]+\)/, // Links: [text](url)
    /^>\s+/m,                // Blockquotes: > quote
    /`[^`]+`/,               // Inline code: `code`
    /^```/m,                 // Code blocks: ```
  ];

  // If it starts with { or [, it's likely JSON
  const trimmed = content.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return false;
  }

  // Check if any markdown pattern matches
  return markdownPatterns.some(pattern => pattern.test(content));
}

/**
 * Formats MCP tool result data for display
 */
function formatMcpResult(data: unknown): string {
  if (data === null || data === undefined) {
    return 'No result';
  }

  if (typeof data === 'string') {
    return data;
  }

  if (typeof data === 'object') {
    // Handle common MCP result structures
    const obj = data as Record<string, unknown>;
    
    // If it has a 'content' field, use that
    if ('content' in obj && typeof obj.content === 'string') {
      return obj.content;
    }
    
    // If it has a 'result' field, use that
    if ('result' in obj) {
      if (typeof obj.result === 'string') {
        return obj.result;
      }
      return JSON.stringify(obj.result, null, 2);
    }
    
    // If it has a 'message' field, use that
    if ('message' in obj && typeof obj.message === 'string') {
      return obj.message;
    }
    
    // If it has a 'text' field, use that
    if ('text' in obj && typeof obj.text === 'string') {
      return obj.text;
    }

    // If it has a 'data' field, format that
    if ('data' in obj) {
      if (typeof obj.data === 'string') {
        return obj.data;
      }
      return JSON.stringify(obj.data, null, 2);
    }

    // Default: stringify the whole object
    return JSON.stringify(data, null, 2);
  }

  // For primitives (number, boolean, etc.)
  return String(data);
}

/**
 * Renders MCP tool results with proper word wrapping
 */
export function McpToolResult({ toolName, data }: McpToolResultProps) {
  const formattedResult = formatMcpResult(data);
  const displayName = toolName.startsWith('mcp_') ? toolName.substring(4) : toolName;

  return (
    <div
      className="rounded-xl overflow-hidden border flex flex-col flex-1 min-h-0"
      style={{
        borderColor: 'var(--vscode-input-border)',
        backgroundColor: 'var(--vscode-textCodeBlock-background)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b shrink-0"
        style={{
          borderColor: 'var(--vscode-input-border)',
          backgroundColor: 'var(--vscode-editor-background)',
        }}
      >
        <Cable
          className="w-3.5 h-3.5 shrink-0"
          style={{ color: 'var(--vscode-charts-purple)' }}
        />
        <span
          className="text-xs font-medium"
          style={{ color: 'var(--vscode-foreground)' }}
        >
          {displayName}
        </span>
      </div>

      {/* Content with proper formatting and scrollable */}
      <div className="p-3 overflow-auto flex-1 min-h-0">
        {isMarkdownContent(formattedResult) ? (
          <div className="text-sm">
            <MarkdownRenderer content={formattedResult} />
          </div>
        ) : (
          <pre
            className="text-xs font-mono m-0"
            style={{
              color: 'var(--vscode-editor-foreground)',
              whiteSpace: 'pre',
            }}
          >
            {formattedResult}
          </pre>
        )}
      </div>
    </div>
  );
}