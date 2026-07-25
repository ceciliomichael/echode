export interface MermaidBlockProps {
  code: string;
  isGenerating?: boolean;
}

export interface MermaidBlockHeaderProps {
  isExpanded: boolean;
  isOpenInTab: boolean;
  isReady: boolean;
  copied: boolean;
  onToggle: () => void;
  onCopy: () => void;
  onOpenInTab: () => void;
}

export interface MermaidBlockContentProps {
  isExpanded: boolean;
  isGenerating: boolean;
  svg: string;
  error: string | null;
}

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
  labelBoxBkgColor: string;
  labelBoxBorderColor: string;
  labelTextColor: string;
  loopTextColor: string;
  activationBorderColor: string;
  activationBkgColor: string;
  box1BkgColor: string;
  box2BkgColor: string;
  boxBorderColor: string;
  boxTextColor: string;
  actorBkg: string;
  actorBorder: string;
  actorTextColor: string;
  actorLineColor: string;
  signalColor: string;
  signalTextColor: string;
}

export interface MermaidParseResult {
  success: boolean;
  error?: {
    message: string;
    str?: string;
    hash?: string;
  };
}
