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
 * Mermaid parse result with success property from mermaid.parse()
 * Used to validate diagram syntax before rendering (Mermaid v11.x)
 */
export interface MermaidParseResult {
  success: boolean;
  error?: {
    message: string;
    str?: string;
    hash?: string;
  };
}