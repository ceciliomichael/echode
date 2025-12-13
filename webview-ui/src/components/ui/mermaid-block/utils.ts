import type { MermaidThemeConfig } from './types';

/**
 * Helper to get computed CSS variable value
 */
export const getCssVar = (varName: string, fallback: string): string => {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return value || fallback;
};

/**
 * Get mermaid theme configuration from VS Code CSS variables
 */
export const getMermaidThemeConfig = (): MermaidThemeConfig => {
  const bgColor = getCssVar('--vscode-editor-background', '#1e1e1e');
  const fgColor = getCssVar('--vscode-foreground', '#cccccc');
  const primaryColor = getCssVar('--vscode-button-background', '#0e639c');
  const borderColor = getCssVar('--vscode-input-border', '#3c3c3c');

  return {
    primaryColor: primaryColor,
    primaryTextColor: fgColor,
    primaryBorderColor: borderColor,
    lineColor: fgColor,
    secondaryColor: bgColor,
    tertiaryColor: bgColor,
    background: bgColor,
    mainBkg: bgColor,
    nodeBorder: borderColor,
    clusterBkg: bgColor,
    clusterBorder: borderColor,
    titleColor: fgColor,
    edgeLabelBackground: bgColor,
    textColor: fgColor,
    edgeLabelColor: fgColor,
    noteBkgColor: bgColor,
    noteBorderColor: borderColor,
  };
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