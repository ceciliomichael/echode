/**
 * Props for the main MermaidBlock component
 */
export interface MermaidBlockProps {
  code: string;
  isGenerating?: boolean;
}

/**
 * Props for the MermaidBlockHeader component
 */
export interface MermaidBlockHeaderProps {
  isExpanded: boolean;
  isOpenInTab: boolean;
  isReady: boolean;
  copied: boolean;
  onToggle: () => void;
  onCopy: () => void;
  onOpenInTab: () => void;
}

/**
 * Props for the MermaidBlockContent component
 */
export interface MermaidBlockContentProps {
  isExpanded: boolean;
  isGenerating: boolean;
  svg: string;
}

/**
 * Mermaid theme configuration derived from VS Code CSS variables
 */
export interface MermaidThemeConfig {
  primaryColor: string;
  primaryTextColor: string;
  primaryBorderColor: string;
  lineColor: string;
  secondaryColor: string;
  tertiaryColor: string;
  background: string;
  mainBkg: string;
  nodeBorder: string;
  clusterBkg: string;
  clusterBorder: string;
  titleColor: string;
  edgeLabelBackground: string;
  textColor: string;
  edgeLabelColor: string;
  noteBkgColor: string;
  noteBorderColor: string;
}