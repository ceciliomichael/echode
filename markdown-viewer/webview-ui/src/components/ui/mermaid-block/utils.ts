import type { MermaidThemeConfig } from './types';

export const getCssVar = (varName: string, fallback: string): string => {
  if (typeof document === 'undefined') { return fallback; }
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return value || fallback;
};

export const getMermaidThemeConfig = (): MermaidThemeConfig => {
  const bgColor = getCssVar('--vscode-editor-background', '#1e1e1e');
  const isDarkMode = bgColor.startsWith('#1') || bgColor.startsWith('#2') || bgColor.startsWith('#0');

  if (isDarkMode) {
    return {
      primaryColor: '#3b82f6',
      primaryTextColor: '#ffffff',
      primaryBorderColor: '#60a5fa',
      lineColor: '#9ca3af',
      secondaryColor: '#8b5cf6',
      tertiaryColor: '#ec4899',
      background: '#1e1e1e',
      mainBkg: '#2d2d2d',
      secondaryBkg: '#3b82f6',
      tertiaryBkg: '#8b5cf6',
      nodeBorder: '#9ca3af',
      clusterBkg: '#2d2d2d',
      clusterBorder: '#9ca3af',
      titleColor: '#ffffff',
      edgeLabelBackground: '#2d2d2d',
      textColor: '#e5e7eb',
      edgeLabelColor: '#e5e7eb',
      noteBkgColor: '#2d2d2d',
      noteBorderColor: '#666666',
      noteTextColor: '#e5e7eb',
      labelBoxBkgColor: '#2d2d2d',
      labelBoxBorderColor: '#666666',
      labelTextColor: '#e5e7eb',
      loopTextColor: '#e5e7eb',
      activationBorderColor: '#666666',
      activationBkgColor: '#2d2d2d',
      actorBkg: '#1e1e1e',
      actorBorder: '#666666',
      actorTextColor: '#e5e7eb',
      actorLineColor: '#666666',
      signalColor: '#e5e7eb',
      signalTextColor: '#e5e7eb',
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
      labelBoxBkgColor: '#e5e7eb',
      labelBoxBorderColor: '#9ca3af',
      labelTextColor: '#1f2937',
      loopTextColor: '#1f2937',
      activationBorderColor: '#9ca3af',
      activationBkgColor: '#f3f4f6',
      actorBkg: '#ffffff',
      actorBorder: '#9ca3af',
      actorTextColor: '#1f2937',
      actorLineColor: '#6b7280',
      signalColor: '#1f2937',
      signalTextColor: '#1f2937',
      box1BkgColor: '#f3f4f6',
      box2BkgColor: '#e5e7eb',
      boxBorderColor: '#9ca3af',
      boxTextColor: '#1f2937',
    };
  }
};

const isLightColor = (r: number, g: number, b: number): boolean => {
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6;
};

const parseRgbFill = (fill: string): { r: number; g: number; b: number } | null => {
  const rgbMatch = fill.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
    };
  }
  
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

export const makeResponsiveSvg = (svg: string): string => {
  let processed = svg.replace(
    /(<rect[^>]*fill=")([^"]+)("[^>]*>)/g,
    (match, prefix, fill, suffix) => {
      if (match.includes('class="actor"')) {
        return match;
      }
      
      const rgb = parseRgbFill(fill);
      if (rgb && isLightColor(rgb.r, rgb.g, rgb.b)) {
        return `${prefix}#2d2d2d${suffix}`;
      }
      return match;
    }
  );

  const maxWidthMatch = processed.match(/style="[^"]*max-width:\s*(\d+(?:\.\d+)?px)[^"]*"/);
  if (maxWidthMatch) {
    const maxWidthValue = maxWidthMatch[1];
    processed = processed.replace(/width="100%"/, `width="${maxWidthValue}"`);
  }

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

export const createOffscreenContainer = (): HTMLDivElement => {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = '2000px';
  container.style.height = '2000px';
  container.style.overflow = 'hidden';
  container.style.pointerEvents = 'none';
  container.style.opacity = '0';
  return container;
};

export const removeContainer = (container: HTMLDivElement): void => {
  if (container.parentNode) {
    container.parentNode.removeChild(container);
  }
};

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

export const fixMermaidCode = (code: string): string => {
  let fixed = code;

  fixed = fixed.replace(
    /^[ \t]*style\s+\S+\s+fill:[^\r\n]*$/gm,
    ''
  );

  fixed = fixed.replace(
    /([a-zA-Z0-9_-]+)(\s*)\[\s*(?!(?:"|[[(/\\]))([^\r\n\]]*?)\s*\]/g,
    '$1$2["$3"]'
  );

  fixed = fixed.replace(
    /(^|\r?\n)(\s*)(\S+)\s+(--x)\s+"([^"\r\n]+)"\s+(\S+)/g,
    '$1$2$3 $4|$5| $6'
  );
  fixed = fixed.replace(
    /(^|\r?\n)(\s*)(\S+)\s+(--x)\s+"([^"\r\n]+)"\s*(?=\r?\n|$)/g,
    '$1$2$3 $4|$5| $3'
  );

  fixed = fixed.replace(/\.\.\|>/g, '-.->');

  return fixed;
};
