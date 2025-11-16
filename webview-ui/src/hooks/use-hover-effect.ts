import type { MouseEvent } from 'react';

/**
 * Custom hook for consistent hover effects across components
 * Eliminates inline onMouseEnter/onMouseLeave duplication
 */
export function useHoverEffect() {
  const handleMouseEnter = (
    e: MouseEvent<HTMLElement>,
    styles: Partial<CSSStyleDeclaration>
  ) => {
    Object.assign(e.currentTarget.style, styles);
  };

  const handleMouseLeave = (
    e: MouseEvent<HTMLElement>,
    styles: Partial<CSSStyleDeclaration>
  ) => {
    Object.assign(e.currentTarget.style, styles);
  };

  return { handleMouseEnter, handleMouseLeave };
}

/**
 * Preset hover effects for common patterns
 */
export const hoverPresets = {
  button: {
    enter: {
      borderColor: 'rgba(255, 255, 255, 0.4)',
      boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.3)',
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    leave: {
      borderColor: 'var(--vscode-input-border)',
      boxShadow: 'none',
      backgroundColor: 'transparent',
    },
  },
  listItem: {
    enter: {
      backgroundColor: 'var(--vscode-list-hoverBackground)',
    },
    leave: {
      backgroundColor: 'transparent',
    },
  },
};
