import { useEffect, type RefObject } from 'react';

/**
 * Custom hook to auto-resize textarea based on content
 * Eliminates duplication between chat-input and message-edit-form
 */
export function useAutoResizeTextarea(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  value: string
) {
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value, textareaRef]);
}
