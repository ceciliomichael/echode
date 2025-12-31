import type { MermaidThemeConfig } from './types';

/**
 * Helper to get computed CSS variable value
 */
export const getCssVar = (varName: string, fallback: string): string => {
  if (typeof document === 'undefined') { return fallback; }
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return value || fallback;
};

/**
 * Get mermaid theme configuration with improved colors
 * Uses a balanced color scheme that works well in both light and dark modes
 */
export const getMermaidThemeConfig = (): MermaidThemeConfig => {
  const bgColor = getCssVar('--vscode-editor-background', '#1e1e1e');

  // Detect if we're in dark mode by checking background brightness
  const isDarkMode = bgColor.startsWith('#1') || bgColor.startsWith('#2') || bgColor.startsWith('#0');

  if (isDarkMode) {
    return {
      primaryColor: '#3b82f6',
      primaryTextColor: '#ffffff',
      primaryBorderColor: '#60a5fa',
      lineColor: '#6b7280',
      secondaryColor: '#8b5cf6',
      tertiaryColor: '#ec4899',
      background: '#1e1e1e',
      mainBkg: '#2d2d2d',
      secondaryBkg: '#3b82f6',
      tertiaryBkg: '#8b5cf6',
      nodeBorder: '#6b7280',
      clusterBkg: '#2d2d2d',
      clusterBorder: '#6b7280',
      titleColor: '#ffffff',
      edgeLabelBackground: '#2d2d2d',
      textColor: '#e5e7eb',
      edgeLabelColor: '#e5e7eb',
      noteBkgColor: '#374151',
      noteBorderColor: '#6b7280',
      noteTextColor: '#e5e7eb',
    };
  } else {
    return {
      primaryColor: '#2563eb',
      primaryTextColor: '#1f2937',
      primaryBorderColor: '#3b82f6',
      lineColor: '#6b7280',
      secondaryColor: '#7c3aed',
      tertiaryColor: '#db2777',
      background: '#ffffff',
      mainBkg: '#f3f4f6',
      secondaryBkg: '#3b82f6',
      tertiaryBkg: '#7c3aed',
      nodeBorder: '#9ca3af',
      clusterBkg: '#f3f4f6',
      clusterBorder: '#9ca3af',
      titleColor: '#1f2937',
      edgeLabelBackground: '#f3f4f6',
      textColor: '#1f2937',
      edgeLabelColor: '#1f2937',
      noteBkgColor: '#e5e7eb',
      noteBorderColor: '#9ca3af',
      noteTextColor: '#1f2937',
    };
  }
};

/**
 * Post-process SVG to make it responsive
 * Removes hardcoded width/height and ensures it fits within container
 */
export const makeResponsiveSvg = (svg: string): string => {
  return svg
    .replace(/width="[^"]*"/, '')
    .replace(/height="[^"]*"/, '')
    .replace(/style="[^"]*"/, 'style="max-width: 100%; max-height: 100%;"');
};

/**
 * Create an offscreen sandbox container for mermaid rendering
 * This prevents mermaid from injecting error SVGs into the visible document
 */
export const createOffscreenContainer = (): HTMLDivElement => {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = '0';
  container.style.height = '0';
  container.style.overflow = 'hidden';
  container.style.pointerEvents = 'none';
  container.style.opacity = '0';
  return container;
};

/**
 * Remove container from DOM safely
 */
export const removeContainer = (container: HTMLDivElement): void => {
  if (container.parentNode) {
    container.parentNode.removeChild(container);
  }
};

/**
 * CSS styles for the mermaid SVG container
 */
export const MERMAID_CONTAINER_STYLES = `
  .mermaid-svg-container {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .mermaid-svg-container svg {
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    display: block;
    object-fit: contain;
  }
`;