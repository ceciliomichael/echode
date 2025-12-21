import { useState, useRef, useEffect, useCallback } from 'react';
import type { TooltipPosition, UseTooltipBehaviorReturn } from '../types';

interface UseTooltipBehaviorProps {
  onFileClick?: (filePath: string) => void;
  onRefactorRequest?: (filePath: string) => void;
}

/**
 * Hook for managing tooltip behavior including show/hide, position, and file selection
 */
export function useTooltipBehavior({
  onFileClick,
  onRefactorRequest,
}: UseTooltipBehaviorProps): UseTooltipBehaviorReturn {
  const [showTooltip, setShowTooltip] = useState(false);
  const [isTopTooltip, setIsTopTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition>('above');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  
  const buttonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<number | null>(null);

  const calculatePosition = useCallback((): TooltipPosition => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceAbove = rect.top;
      // Show below if not enough space above (tooltip is ~250px tall)
      return spaceAbove < 280 ? 'below' : 'above';
    }
    return 'above';
  }, []);

  const handleMouseEnter = useCallback(() => {
    window.dispatchEvent(new CustomEvent('echode-tooltip-hover', { detail: 'refactor' }));
    if (hideTimeoutRef.current !== null) {
      window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setTooltipPosition(calculatePosition());
    // Only reset selection if tooltip wasn't already showing
    if (!showTooltip) {
      setSelectedFile(null);
    }
    setShowTooltip(true);
  }, [calculatePosition, showTooltip]);

  const handleMouseLeave = useCallback(() => {
    if (hideTimeoutRef.current !== null) {
      window.clearTimeout(hideTimeoutRef.current);
    }
    hideTimeoutRef.current = window.setTimeout(() => {
      setShowTooltip(false);
      setSelectedFile(null);
    }, 150);
  }, []);

  const handleFocus = useCallback(() => {
    if (hideTimeoutRef.current !== null) {
      window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setTooltipPosition(calculatePosition());
    if (!showTooltip) {
      setSelectedFile(null);
    }
    setShowTooltip(true);
  }, [calculatePosition, showTooltip]);

  const handleBlur = useCallback((event: React.FocusEvent) => {
    // Check if focus is moving to another element within the container
    const relatedTarget = event.relatedTarget as Node | null;
    if (relatedTarget && containerRef.current?.contains(relatedTarget)) {
      // Focus is still within the component, don't close
      return;
    }
    // Focus moved outside, close with a small delay
    if (hideTimeoutRef.current !== null) {
      window.clearTimeout(hideTimeoutRef.current);
    }
    hideTimeoutRef.current = window.setTimeout(() => {
      setShowTooltip(false);
      setSelectedFile(null);
    }, 150);
  }, []);

  const handleFileClick = useCallback((filePath: string) => {
    if (onFileClick) {
      onFileClick(filePath);
    }
    setSelectedFile(filePath);
  }, [onFileClick]);

  const handleConfirmRefactor = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedFile && onRefactorRequest) {
      onRefactorRequest(selectedFile);
      setSelectedFile(null);
      setShowTooltip(false);
    }
  }, [selectedFile, onRefactorRequest]);

  const handleCancelRefactor = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
  }, []);

  useEffect(() => {
    const handleContextHover = () => {
      if (hideTimeoutRef.current !== null) {
        window.clearTimeout(hideTimeoutRef.current);
      }
      setShowTooltip(false);
    };

    window.addEventListener('echode-context-indicator-hover', handleContextHover as EventListener);

    const handleTooltipHover = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      setIsTopTooltip(customEvent.detail === 'refactor');
    };

    window.addEventListener('echode-tooltip-hover', handleTooltipHover as EventListener);

    // Click outside handler for confirmation prompt
    const handleClickOutside = (event: MouseEvent) => {
      if (selectedFile && containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setSelectedFile(null);
        setShowTooltip(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('echode-context-indicator-hover', handleContextHover as EventListener);
      window.removeEventListener('echode-tooltip-hover', handleTooltipHover as EventListener);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectedFile]);

  return {
    state: {
      showTooltip,
      isTopTooltip,
      tooltipPosition,
      selectedFile,
      setShowTooltip,
      setSelectedFile,
    },
    handlers: {
      handleMouseEnter,
      handleMouseLeave,
      handleFocus,
      handleBlur,
      handleFileClick,
      handleConfirmRefactor,
      handleCancelRefactor,
    },
    refs: {
      buttonRef,
      containerRef,
    },
  };
}