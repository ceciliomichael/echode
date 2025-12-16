/**
 * Props for the DashedProgressCircle component
 */
export interface DashedProgressCircleProps {
  percent: number;
  color: string;
  size?: number;
  isScanning?: boolean;
}

/**
 * Information about a large file that may need refactoring
 */
export interface LargeFileInfo {
  path: string;
  lineCount: number;
}

/**
 * Props for the RefactorIndicator component
 */
export interface RefactorIndicatorProps {
  largeFiles: LargeFileInfo[];
  isScanning?: boolean;
  disabled?: boolean;
  onFileClick?: (filePath: string) => void;
  onRefactorRequest?: (filePath: string) => void;
}

/**
 * Tooltip position type
 */
export type TooltipPosition = 'above' | 'below';

/**
 * Return type for the useTooltipBehavior hook
 */
export interface TooltipBehaviorState {
  showTooltip: boolean;
  isTopTooltip: boolean;
  tooltipPosition: TooltipPosition;
  selectedFile: string | null;
  setShowTooltip: (show: boolean) => void;
  setSelectedFile: (file: string | null) => void;
}

export interface TooltipBehaviorHandlers {
  handleMouseEnter: () => void;
  handleMouseLeave: () => void;
  handleFileClick: (filePath: string) => void;
  handleConfirmRefactor: (e: React.MouseEvent) => void;
  handleCancelRefactor: (e: React.MouseEvent) => void;
}

export interface TooltipBehaviorRefs {
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export interface UseTooltipBehaviorReturn {
  state: TooltipBehaviorState;
  handlers: TooltipBehaviorHandlers;
  refs: TooltipBehaviorRefs;
}