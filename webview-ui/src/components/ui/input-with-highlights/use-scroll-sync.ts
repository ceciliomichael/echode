import { useCallback } from 'react';
import type { RefObject } from 'react';

interface UseScrollSyncParams {
    textareaRef: RefObject<HTMLTextAreaElement | null>;
    backdropRef: RefObject<HTMLDivElement | null>;
}

/**
 * Hook that synchronizes scroll position between textarea and backdrop
 */
export function useScrollSync({ textareaRef, backdropRef }: UseScrollSyncParams) {
    const handleScroll = useCallback(() => {
        if (backdropRef.current && textareaRef.current) {
            backdropRef.current.scrollTop = textareaRef.current.scrollTop;
            backdropRef.current.scrollLeft = textareaRef.current.scrollLeft;
        }
    }, [backdropRef, textareaRef]);

    return { handleScroll };
}