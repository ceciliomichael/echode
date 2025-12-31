/**
 * Shared Mermaid theme configuration
 * Generates theme variables that work well with VS Code's color scheme
 */

export interface MermaidThemeVariables {
  primaryColor: string;
  primaryTextColor: string;
  primaryBorderColor: string;
  lineColor: string;
  secondaryColor: string;
  tertiaryColor: string;
  background: string;
  mainBkg: string;
  secondaryBkg: string;
  tertiaryBkg: string;
  nodeBorder: string;
  clusterBkg: string;
  clusterBorder: string;
  titleColor: string;
  edgeLabelBackground: string;
  textColor: string;
  edgeLabelColor: string;
  noteBkgColor: string;
  noteBorderColor: string;
  noteTextColor: string;
}

/**
 * Generate Mermaid theme variables from VS Code theme detection
 * This creates a visually appealing theme that matches VS Code's appearance
 */
export function generateMermaidTheme(isDark: boolean): MermaidThemeVariables {
  if (isDark) {
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
}