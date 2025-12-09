import { useEffect, useState, type RefObject } from 'react';

export type DropdownDirection = 'up' | 'down';

interface UseDropdownDirectionOptions {
  boundarySelector?: string;
  defaultDirection?: DropdownDirection;
  estimatedPanelHeight?: number;
}

export function useDropdownDirection(
  triggerRef: RefObject<HTMLElement | null>,
  options: UseDropdownDirectionOptions = {}
): DropdownDirection {
  const {
    boundarySelector = '[data-chat-scroll-container="true"]',
    defaultDirection = 'down',
    estimatedPanelHeight = 260,
  } = options;

  const [direction, setDirection] = useState<DropdownDirection>(defaultDirection);

  useEffect(() => {
    let frameId: number | null = null;

    const measure = () => {
      const trigger = triggerRef.current;
      if (!trigger) {
        setDirection(defaultDirection);
        return;
      }

      const boundary = document.querySelector(boundarySelector) as HTMLElement | null;
      if (!boundary) {
        setDirection(defaultDirection);
        return;
      }

      const boundaryRect = boundary.getBoundingClientRect();
      const triggerRect = trigger.getBoundingClientRect();

      const spaceAbove = triggerRect.top - boundaryRect.top;
      const spaceBelow = boundaryRect.bottom - triggerRect.bottom;

      const required = estimatedPanelHeight;

      let nextDirection: DropdownDirection;
      if (spaceBelow >= required) {
        nextDirection = 'down';
      } else if (spaceAbove >= required) {
        nextDirection = 'up';
      } else {
        nextDirection = spaceBelow >= spaceAbove ? 'down' : 'up';
      }

      setDirection((prev) => (prev === nextDirection ? prev : nextDirection));
    };

    const boundary = document.querySelector(boundarySelector) as HTMLElement | null;

    const scheduleMeasure = () => {
      if (frameId !== null) {
        return;
      }
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        measure();
      });
    };

    scheduleMeasure();

    if (boundary) {
      boundary.addEventListener('scroll', scheduleMeasure, { passive: true });
    }
    window.addEventListener('resize', scheduleMeasure);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
        frameId = null;
      }
      if (boundary) {
        boundary.removeEventListener('scroll', scheduleMeasure);
      }
      window.removeEventListener('resize', scheduleMeasure);
    };
  }, [boundarySelector, defaultDirection, estimatedPanelHeight, triggerRef]);

  return direction;
}
