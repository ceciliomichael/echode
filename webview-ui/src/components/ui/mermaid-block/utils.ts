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
      lineColor: '#9ca3af', // Lighter gray for better visibility
      secondaryColor: '#8b5cf6',
      tertiaryColor: '#ec4899',
      background: '#1e1e1e',
      mainBkg: '#2d2d2d',
      secondaryBkg: '#3b82f6',
      tertiaryBkg: '#8b5cf6',
      nodeBorder: '#9ca3af', // Lighter border
      clusterBkg: '#2d2d2d',
      clusterBorder: '#9ca3af',
      titleColor: '#ffffff',
      edgeLabelBackground: '#2d2d2d',
      textColor: '#e5e7eb',
      edgeLabelColor: '#e5e7eb',
      noteBkgColor: '#2d2d2d',
      noteBorderColor: '#666666',
      noteTextColor: '#e5e7eb',
      // Sequence diagram specific - rect/loop/alt blocks
      labelBoxBkgColor: '#2d2d2d',
      labelBoxBorderColor: '#666666',
      labelTextColor: '#e5e7eb',
      loopTextColor: '#e5e7eb',
      activationBorderColor: '#666666',
      activationBkgColor: '#2d2d2d',
      // Actor styling
      actorBkg: '#1e1e1e',
      actorBorder: '#666666',
      actorTextColor: '#e5e7eb',
      actorLineColor: '#666666',
      // Signal/message colors
      signalColor: '#e5e7eb',
      signalTextColor: '#e5e7eb',
      // Sequence diagram box syntax (box Actor1, Actor2)
      box1BkgColor: '#2d2d2d',
      box2BkgColor: '#3a3a3a',
      boxBorderColor: '#666666',
      boxTextColor: '#e5e7eb',
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
      // Sequence diagram specific - rect/loop/alt blocks
      labelBoxBkgColor: '#e5e7eb',
      labelBoxBorderColor: '#9ca3af',
      labelTextColor: '#1f2937',
      loopTextColor: '#1f2937',
      activationBorderColor: '#9ca3af',
      activationBkgColor: '#f3f4f6',
      // Actor styling
      actorBkg: '#ffffff',
      actorBorder: '#9ca3af',
      actorTextColor: '#1f2937',
      actorLineColor: '#6b7280',
      // Signal/message colors
      signalColor: '#1f2937',
      signalTextColor: '#1f2937',
      // Sequence diagram box syntax (box Actor1, Actor2)
      box1BkgColor: '#f3f4f6',
      box2BkgColor: '#e5e7eb',
      boxBorderColor: '#9ca3af',
      boxTextColor: '#1f2937',
    };
  }
};

/**
 * Check if an RGB color is "light" (high luminance)
 * Returns true if the color would have poor contrast with light text
 */
const isLightColor = (r: number, g: number, b: number): boolean => {
  // Calculate relative luminance using sRGB formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6; // Threshold for "light" colors
};

/**
 * Parse RGB values from various fill formats
 * Handles: rgb(r, g, b), rgb(r,g,b), #rrggbb, #rgb
 */
const parseRgbFill = (fill: string): { r: number; g: number; b: number } | null => {
  // Match rgb(r, g, b) or rgb(r,g,b)
  const rgbMatch = fill.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
    };
  }
  
  // Match #rrggbb
  const hexMatch = fill.match(/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (hexMatch) {
    return {
      r: parseInt(hexMatch[1], 16),
      g: parseInt(hexMatch[2], 16),
      b: parseInt(hexMatch[3], 16),
    };
  }
  
  return null;
};

/**
 * Post-process SVG to make it responsive and fix light fills for dark mode
 * - Converts percentage widths to pixel values for proper sizing in absolute containers
 * - Replaces light rect fills with dark background for better contrast
 */
export const makeResponsiveSvg = (svg: string): string => {
  // Replace light rect fills with dark background
  // This regex finds rect elements with fill attributes containing light colors
  let processed = svg.replace(
    /(<rect[^>]*fill=")([^"]+)("[^>]*>)/g,
    (match, prefix, fill, suffix) => {
      // Skip if this is an actor element (has class="actor")
      if (match.includes('class="actor"')) {
        return match;
      }
      
      const rgb = parseRgbFill(fill);
      if (rgb && isLightColor(rgb.r, rgb.g, rgb.b)) {
        // Replace light fill with dark gray
        return `${prefix}#2d2d2d${suffix}`;
      }
      return match;
    }
  );

  // Mermaid outputs width="100%" with max-width in style for the actual size.
  // For absolute-positioned containers, we need a real pixel width.
  // Extract max-width from style and use it as the width attribute.
  const maxWidthMatch = processed.match(/style="[^"]*max-width:\s*(\d+(?:\.\d+)?px)[^"]*"/);
  if (maxWidthMatch) {
    const maxWidthValue = maxWidthMatch[1];
    // Replace width="100%" with the actual max-width value
    processed = processed.replace(/width="100%"/, `width="${maxWidthValue}"`);
  }

  // Extract viewBox height if width="100%" wasn't replaced and we have viewBox
  if (processed.includes('width="100%"')) {
    const viewBoxMatch = processed.match(/viewBox="[\d.]+ [\d.]+ ([\d.]+) ([\d.]+)"/);
    if (viewBoxMatch) {
      const viewBoxWidth = viewBoxMatch[1];
      const viewBoxHeight = viewBoxMatch[2];
      processed = processed
        .replace(/width="100%"/, `width="${viewBoxWidth}"`)
        .replace(/height="100%"/, `height="${viewBoxHeight}"`);
    }
  }

  return processed;
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
  // Mermaid needs actual dimensions to calculate SVG layout properly
  container.style.width = '2000px';
  container.style.height = '2000px';
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
 * Light fills are handled by JavaScript post-processing in makeResponsiveSvg
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