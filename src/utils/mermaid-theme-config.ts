/**
 * Shared Mermaid theme configuration
 * Generates theme variables that work well with VS Code's color scheme
 * 
 * IMPORTANT: This config must stay in sync with webview-ui/src/components/ui/mermaid-block/utils.ts
 * Both files define mermaid theme variables - any changes here should be reflected there and vice versa.
 */

export interface MermaidThemeVariables {
  // Core colors
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
  // Sequence diagram specific - rect/loop/alt blocks
  labelBoxBkgColor: string;
  labelBoxBorderColor: string;
  labelTextColor: string;
  loopTextColor: string;
  activationBorderColor: string;
  activationBkgColor: string;
  // Sequence diagram box syntax (box Actor1, Actor2)
  box1BkgColor: string;
  box2BkgColor: string;
  boxBorderColor: string;
  boxTextColor: string;
  // Actor styling
  actorBkg: string;
  actorBorder: string;
  actorTextColor: string;
  actorLineColor: string;
  // Signal/message colors
  signalColor: string;
  signalTextColor: string;
}

/**
 * Generate Mermaid theme variables from VS Code theme detection
 * This creates a visually appealing theme that matches VS Code's appearance
 * 
 * These values are synchronized with webview-ui/src/components/ui/mermaid-block/utils.ts
 */
export function generateMermaidTheme(isDark: boolean): MermaidThemeVariables {
  if (isDark) {
    return {
      // Core colors
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
      // Core colors
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
}