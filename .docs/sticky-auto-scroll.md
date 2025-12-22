# Robust Sticky Auto-Scroll Technique

This document details the robust "sticky" auto-scroll technique implemented to handle complex chat interfaces with streaming content, large layout shifts, and user interaction.

## The Challenge

Implementing a chat interface that "sticks" to the bottom while streaming response tokens is deceptively difficult due to several factors:

1.  **Race Conditions:** Browser layout updates, scroll events, and React state updates happen asynchronously.
2.  **Scroll Anchoring:** When content is added to the bottom, browsers typically keep the viewport anchored to the *current* content (keeping `scrollTop` constant), which effectively pushes the new content off-screen.
3.  **User Intent vs. Layout Shifts:** It is difficult to distinguish between a user intentionally scrolling up to read history and the browser simply not scrolling down fast enough when a large block of content (like a code block or "Thinking" section) appears.
4.  **Animation Conflicts:** Smooth scrolling animations create a temporary state where the user is "not at the bottom," which can be misinterpreted as a manual scroll-up.

## The Solution: State-Based "Sticky" Logic

Instead of trying to calculate scroll deltas (e.g., "did the user scroll up by 5px?"), which is brittle, we use a state-based approach.

### Core Concept

1.  **State `userHasScrolled`**: This boolean tracks whether the user has *intentionally* left the bottom of the chat.
2.  **The Lock**:
    *   If `userHasScrolled` is `false`, the view is **locked** to the bottom. A `ResizeObserver` constantly forces `scrollTop = scrollHeight`.
    *   If `userHasScrolled` is `true`, the view is **unlocked**. The user is free to roam.
3.  **The Trigger**:
    *   If the user is at the bottom (within a small tolerance), `userHasScrolled` becomes `false` (Lock enabled).
    *   If the user scrolls up, `userHasScrolled` becomes `true` (Lock disabled).

## Implementation Details

### 1. Handling Large Content Shifts

When a large chunk of content is added (e.g., +500px height), the `ResizeObserver` detects the height change. However, the browser's scroll event might fire *before* our observer can react, or the observer might fire before the browser paints.

If we simply check `isAtBottom` during a content update, it will return `false` (because content grew but `scrollTop` hasn't caught up), causing us to incorrectly set `userHasScrolled = true`.

**Fix:** Detect Content Growth vs. User Scroll.

```typescript
// Inside handleScroll
const { scrollTop, scrollHeight } = elem;

// Case 1: We are at the bottom. Lock it.
if (isAtBottom) {
  setUserHasScrolled(false);
  return;
}

// Case 2: Content grew since the last frame.
// Even though we aren't at the bottom yet, this was likely a layout shift, not a user action.
// Ignore this event to preserve the existing lock state.
if (scrollHeight > lastScrollHeightRef.current) {
  return; 
}

// Case 3: Content didn't grow, but we aren't at the bottom.
// Only unlock if the user strictly scrolled UP.
if (scrollTop < lastScrollTopRef.current) {
  setUserHasScrolled(true);
}
```

### 2. Preventing Smooth Scroll Interference

When sending a message, it's tempting to use `behavior: 'smooth'`. However, smooth scrolling takes time (e.g., 300ms). During this time, `isAtBottom` is `false`.

If `handleScroll` fires during the animation, it sees "not at bottom" + "no content growth" and incorrectly unlocks the view (`userHasScrolled = true`). When the AI response starts streaming milliseconds later, the view is unlocked, so it doesn't auto-scroll.

**Fix:** Use `behavior: 'auto'` (instant scroll) for all programmatic scrolls when the chat is active. This eliminates the ambiguous intermediate state.

### 3. Handling Initial Load (The "New Chat" Bug)

In React, the chat content container often doesn't exist until the first message is rendered. If `ResizeObserver` is set up on mount (`[]` dependency), it might observe a placeholder or nothing.

**Fix:** Re-attach the `ResizeObserver` whenever `messageCount` changes.

```typescript
useEffect(() => {
  // Re-attach observer to ensure we catch the newly created content wrapper
  if (scrollContentRef.current) {
    observer.observe(scrollContentRef.current);
  }
}, [messageCount]); 
```

### 4. Safety Force-Scroll

To handle any remaining race conditions where the DOM updates before the observer fires, we force a scroll to bottom whenever a new message arrives.

```typescript
useEffect(() => {
  setUserHasScrolled(false); // Reset lock
  // Force DOM update immediately
  if (container) container.scrollTop = container.scrollHeight;
}, [messageCount]);
```

## Summary Checklist for Implementation

- [ ] **State**: Use a simple boolean (`userHasScrolled`) to track intent.
- [ ] **Observer**: Use `ResizeObserver` to enforce the scroll position when locked.
- [ ] **Instant Scroll**: Avoid smooth scrolling during active chat sessions.
- [ ] **Growth Detection**: In your scroll handler, ignore "not at bottom" states if `scrollHeight` has increased since the last frame.
- [ ] **Initialization**: Ensure observers re-run when the DOM structure changes (e.g., first message).