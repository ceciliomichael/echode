import { useCallback, useState } from 'react';
import type { RefObject } from 'react';

interface UseScrollSyncParams {
    textareaRef: RefObject<HTMLTextAreaElement | null>;
}

interface ScrollOffset {
    top: number;
    left: number;
}

/**
 * Hook that tracks scroll position for CSS transform-based sync
 * Uses transforms instead of scrollTop for better compatibility with overflow-hidden
 */
export function useScrollSync({ textareaRef }: UseScrollSyncParams) {
    const [scrollOffset, setScrollOffset] = useState<ScrollOffset>({ top: 0, left: 0 });

    const handleScroll = useCallback(() => {
        if (textareaRef.current) {
            setScrollOffset({
                top: textareaRef.current.scrollTop,
                left: textareaRef.current.scrollLeft
            });
        }
    }, [textareaRef]);

    return { handleScroll, scrollOffset };
}