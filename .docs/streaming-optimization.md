# Streaming Chat Interface Optimization

## Technique: Stable Segment Rendering for Streaming Content

This document describes a React optimization technique for chat interfaces that stream AI responses, ensuring that completed content (like code blocks and text selections) remains stable and functional during streaming.

## Problem Statement

When AI responses stream in real-time, the entire message component re-renders with each chunk of new content. This causes:

- Code blocks to remount, losing their internal state (copy button states)
- Text selections to be deselected
- Performance degradation from unnecessary re-renders
- Poor user experience during streaming

## Solution Overview

Split the streaming markdown content into stable, memoized segments that only re-render when their specific content changes, not when new segments are added.

## Implementation Details

### 1. Memoized CodeBlock Component

```typescript
// Extract code content to strings for stable comparison
const extractCodeContent = (children: React.ReactNode): string => {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(extractCodeContent).join('');
  // ... handle other ReactNode types
  return '';
};

// Memoize CodeBlock with custom comparison
export const CodeBlock = memo(CodeBlockComponent, (prevProps, nextProps) => {
  const prevContent = extractCodeContent(prevProps.children);
  const nextContent = extractCodeContent(nextProps.children);

  // Only re-render if content or language actually changed
  return prevContent === nextContent && prevProps.className === nextProps.className;
});
```

**Key Insight**: Compare extracted string content instead of ReactNode objects, which change on every render.

### 2. Markdown Tokenization

Split streaming markdown into stable text and code segments:

```typescript
type MarkdownToken =
  | { type: 'text'; content: string }
  | { type: 'code'; content: string; lang?: string };

function splitMarkdownIntoTokens(markdown: string): MarkdownToken[] {
  // Parse fenced code blocks and split into tokens
  // Each token gets a stable identity based on its position
}
```

**Key Insight**: Instead of re-parsing the entire markdown tree on each chunk, maintain stable segments.

### 3. Stable Segment Rendering

```typescript
// Memoized markdown renderer
const StableMarkdown = memo(function StableMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  );
}, (prev, next) => prev.content === next.content);

// Render tokens with stable keys
{memoizedTokens.map((token, idx) => {
  if (token.type === 'code') {
    return <CodeBlock key={`code-${idx}`} className={token.lang} content={token.content} />;
  }
  return <StableMarkdown key={`md-${idx}`} content={token.content} />;
})}
```

**Key Insight**: Each segment has its own memoized component and stable key, preventing re-renders of completed segments.

### 4. Selection-Safe Auto-Scroll

```typescript
const scrollToBottom = () => {
  const selection = window.getSelection();
  const hasActiveSelection = !!selection && !selection.isCollapsed;

  if (container && !hasActiveSelection) {
    const distanceFromBottom = container.scrollHeight - (container.scrollTop + container.clientHeight);
    const nearBottom = distanceFromBottom < 80; // 80px threshold
    if (nearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }
};
```

**Key Insight**: Only auto-scroll when user is near bottom and has no active text selection.

## Benefits

1. **Stable Code Blocks**: Copy buttons work immediately, even during streaming
2. **Preserved Selections**: Text selections remain intact while streaming
3. **Performance**: Only the actively-growing segment re-renders
4. **Better UX**: No jarring UI resets during streaming

## Trade-offs

1. **Memory**: Maintains more component instances in memory
2. **Complexity**: More sophisticated parsing and rendering logic
3. **Bundle Size**: Additional memoization utilities

## Usage in Next.js/React Applications

This technique is particularly valuable for:

- AI chat interfaces
- Real-time collaborative editing
- Live streaming content with interactive elements
- Any interface where content streams in while preserving user interactions

## Related Patterns

- Virtual scrolling for large lists
- Incremental rendering
- React's `memo` and `useMemo` optimizations
- Streaming parser implementations
