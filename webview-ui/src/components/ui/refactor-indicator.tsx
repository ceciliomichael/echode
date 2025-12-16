import { useState, useRef, useEffect } from 'react';
import { FileCode, Search, CheckCircle2 } from 'lucide-react';
import { getFileIconConfig } from '../../utils/file-icon-mapper';

interface DashedProgressCircleProps {
  percent: number;
  color: string;
  size?: number;
  isScanning?: boolean;
}

/**
 * Custom dashed circle progress indicator
 * Shows progress by coloring individual dashes based on percentage
 */
function DashedProgressCircle({ percent, color, size = 16 }: DashedProgressCircleProps) {
  const strokeWidth = 1.5;
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  
  // 8 dashes around the circle
  const dashCount = 8;
  const anglePerDash = 360 / dashCount;
  const dashArcAngle = anglePerDash * 0.6; // 60% of segment is dash
  
  // Generate dash arcs
  const dashes = [];
  for (let i = 0; i < dashCount; i++) {
    const startAngle = i * anglePerDash - 90; // Start from top
    const endAngle = startAngle + dashArcAngle;
    
    // Calculate if this dash should be filled based on percentage
    const dashMidpoint = (i + 0.5) / dashCount * 100;
    const isFilled = dashMidpoint <= percent;
    
    // Convert angles to radians
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    
    // Calculate arc points
    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);
    
    // Create arc path
    const path = `M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`;
    
    dashes.push(
      <path
        key={i}
        d={path}
        fill="none"
        stroke={isFilled ? color : 'currentColor'}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        opacity={isFilled ? 1 : 0.25}
      />
    );
  }
  
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
    >
      {dashes}
    </svg>
  );
}

export interface LargeFileInfo {
  path: string;
  lineCount: number;
}

interface RefactorIndicatorProps {
  largeFiles: LargeFileInfo[];
  isScanning?: boolean;
  disabled?: boolean;
  onFileClick?: (filePath: string) => void;
  onRefactorRequest?: (filePath: string) => void;
}

// Neutral color for refactor indicator (matches foreground)
const REFACTOR_COLOR = 'var(--vscode-foreground)';

/**
 * Format line count for display
 */
function formatLines(lines: number): string {
  if (lines >= 1000) {
    return `${(lines / 1000).toFixed(1)}k`;
  }
  return lines.toString();
}

export function RefactorIndicator({ largeFiles, isScanning = false, disabled = false, onFileClick, onRefactorRequest }: RefactorIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [isTopTooltip, setIsTopTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<'above' | 'below'>('above');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<number | null>(null);

  const fileCount = largeFiles.length;
  
  // Calculate percentage based on file count (max 10 files = 100%)
  const percent = Math.min((fileCount / 10) * 100, 100);

  // Calculate tooltip position when showing
  const calculatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceAbove = rect.top;
      // Show below if not enough space above (tooltip is ~250px tall)
      return spaceAbove < 280 ? 'below' : 'above';
    }
    return 'above';
  };

  const handleMouseEnter = () => {
    window.dispatchEvent(new CustomEvent('echode-tooltip-hover', { detail: 'refactor' }));
    if (hideTimeoutRef.current !== null) {
      window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setTooltipPosition(calculatePosition());
    // Only reset selection if tooltip wasn't already showing
    if (!showTooltip) {
      setSelectedFile(null);
    }
    setShowTooltip(true);
  };

  const handleMouseLeave = () => {
    if (hideTimeoutRef.current !== null) {
      window.clearTimeout(hideTimeoutRef.current);
    }
    hideTimeoutRef.current = window.setTimeout(() => {
      setShowTooltip(false);
      setSelectedFile(null);
    }, 150);
  };

  const handleFileClick = (filePath: string) => {
    if (onFileClick) {
      onFileClick(filePath);
    }
    setSelectedFile(filePath);
  };

  const handleConfirmRefactor = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedFile && onRefactorRequest) {
      onRefactorRequest(selectedFile);
      setSelectedFile(null);
      setShowTooltip(false);
    }
  };

  const handleCancelRefactor = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
  };

  // Show dimmed state when no large files and not scanning
  const isEmpty = fileCount === 0 && !isScanning;

  useEffect(() => {
    const handleContextHover = () => {
      if (hideTimeoutRef.current !== null) {
        window.clearTimeout(hideTimeoutRef.current);
      }
      setShowTooltip(false);
    };

    window.addEventListener('echode-context-indicator-hover', handleContextHover as EventListener);

    const handleTooltipHover = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      setIsTopTooltip(customEvent.detail === 'refactor');
    };

    window.addEventListener('echode-tooltip-hover', handleTooltipHover as EventListener);

    // Click outside handler for confirmation prompt
    const handleClickOutside = (event: MouseEvent) => {
      if (selectedFile && containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setSelectedFile(null);
        setShowTooltip(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('echode-context-indicator-hover', handleContextHover as EventListener);
      window.removeEventListener('echode-tooltip-hover', handleTooltipHover as EventListener);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectedFile]);

  return (
    <div 
      ref={containerRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Wave animation keyframes for scanning state */}
      <style>
        {`
          @keyframes refactor-wave-shine {
            0% { background-position: 200% 0; }
            100% { background-position: -100% 0; }
          }
        `}
      </style>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        className="py-1 rounded-xl transition-opacity hover:opacity-70 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ color: isEmpty ? 'var(--vscode-descriptionForeground)' : REFACTOR_COLOR }}
        aria-label={isScanning ? 'Scanning codebase...' : isEmpty ? 'No files need refactoring' : `${fileCount} files may need refactoring`}
      >
        <div className={isScanning ? 'animate-spin' : ''}>
          <DashedProgressCircle 
            percent={isScanning ? 0 : isEmpty ? 0 : percent} 
            color={isScanning ? 'var(--vscode-descriptionForeground)' : isEmpty ? 'var(--vscode-descriptionForeground)' : REFACTOR_COLOR} 
            size={16} 
          />
        </div>
      </button>

      {/* Empty state tooltip */}
      {showTooltip && isEmpty && (
        <div
          className={`absolute z-50 px-3 py-2 rounded-xl border shadow-lg ${
            tooltipPosition === 'above' ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
          style={{
            right: 0,
            backgroundColor: 'var(--vscode-editor-background)',
            borderColor: 'var(--vscode-input-border)',
          }}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--vscode-descriptionForeground)' }} />
            <span
              className="text-xs whitespace-nowrap"
              style={{ color: 'var(--vscode-descriptionForeground)' }}
            >
              No large files found
            </span>
          </div>
        </div>
      )}

      {/* Scanning tooltip */}
      {showTooltip && isScanning && (
        <div
          className={`absolute z-50 px-3 py-2 rounded-xl border shadow-lg ${
            tooltipPosition === 'above' ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
          style={{
            right: 0,
            backgroundColor: 'var(--vscode-editor-background)',
            borderColor: 'var(--vscode-input-border)',
          }}
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5" style={{ color: 'var(--vscode-descriptionForeground)' }} />
            <span
              className="text-xs whitespace-nowrap"
              style={{
                background:
                  'linear-gradient(90deg, var(--vscode-descriptionForeground) 0%, var(--vscode-descriptionForeground) 40%, var(--vscode-foreground) 50%, var(--vscode-descriptionForeground) 60%, var(--vscode-descriptionForeground) 100%)',
                backgroundSize: '300% 100%',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                animation: 'refactor-wave-shine 2s linear infinite',
              }}
            >
              Scanning Codebase
            </span>
          </div>
        </div>
      )}

      {/* Results tooltip */}
      {showTooltip && !isScanning && !isEmpty && (
        <div
          className={`absolute w-72 p-3 rounded-xl border shadow-lg ${
            tooltipPosition === 'above' ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
          style={{
            zIndex: isTopTooltip ? 60 : 40,
            right: 0,
            backgroundColor: 'var(--vscode-editor-background)',
            borderColor: 'var(--vscode-input-border)',
          }}
        >
          {/* Header */}
          {!selectedFile && (
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5" style={{ color: REFACTOR_COLOR }} />
                <span
                  className="text-xs font-semibold"
                  style={{ color: 'var(--vscode-foreground)' }}
                >
                  Refactor Candidates
                </span>
              </div>
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: `${REFACTOR_COLOR}20`,
                  color: REFACTOR_COLOR,
                }}
              >
                {fileCount} {fileCount === 1 ? 'file' : 'files'}
              </span>
            </div>
          )}

          {/* Description */}
          {!selectedFile && (
            <p
              className="text-xs mb-3"
              style={{ color: 'var(--vscode-descriptionForeground)' }}
            >
              Large files that could use some cleanup
            </p>
          )}

          {/* Confirmation View */}
          {selectedFile && (
            <div className="flex flex-col gap-3">
              <p
                className="text-xs"
                style={{ color: 'var(--vscode-foreground)' }}
              >
                Refactor this file?
              </p>
              
              <div 
                className="flex items-center gap-2 px-2 py-1.5 rounded-xl text-xs"
                style={{ 
                  backgroundColor: 'var(--vscode-list-hoverBackground)'
                }}
              >
                {(() => {
                  const iconConfig = getFileIconConfig(selectedFile);
                  const Icon = iconConfig.icon;
                  return <Icon className="w-4 h-4 shrink-0" style={{ color: iconConfig.color }} />;
                })()}
                <span className="truncate font-medium">{selectedFile.split(/[/\\]/).pop()}</span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleConfirmRefactor}
                  className="flex-1 px-3 py-1.5 rounded-xl text-xs transition-all border"
                  style={{ 
                    backgroundColor: 'var(--vscode-button-background)', 
                    color: 'var(--vscode-button-foreground)',
                    borderColor: 'var(--vscode-button-background)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--vscode-button-hoverBackground)';
                    e.currentTarget.style.borderColor = 'var(--vscode-button-hoverBackground)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--vscode-button-background)';
                    e.currentTarget.style.borderColor = 'var(--vscode-button-background)';
                  }}
                >
                  Yes, Refactor
                </button>
                <button
                  onClick={handleCancelRefactor}
                  className="flex-1 px-3 py-1.5 rounded-xl text-xs transition-all border"
                  style={{ 
                    color: 'var(--vscode-foreground)',
                    borderColor: 'var(--vscode-input-border)',
                    backgroundColor: 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                    e.currentTarget.style.boxShadow = '0 0 0 1px rgba(255, 255, 255, 0.3)';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--vscode-input-border)';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* File list */}
          {!selectedFile && (
            <div className="rounded-xl overflow-hidden border border-[var(--vscode-input-border)] bg-[var(--vscode-editor-background)]">
            <div
              className="max-h-40 overflow-y-auto"
              style={{ scrollbarWidth: 'thin' }}
            >
              {largeFiles.map((file, index) => {
              const iconConfig = getFileIconConfig(file.path);
              const Icon = iconConfig.icon;
              const isLast = index === largeFiles.length - 1;

              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleFileClick(file.path)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${isLast ? '' : 'border-b border-[var(--vscode-input-border)]'}`}
                  style={{ 
                    color: 'var(--vscode-foreground)',
                    backgroundColor: 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <Icon
                    className="w-4 h-4 flex-shrink-0"
                    style={{ color: iconConfig.color }}
                  />
                  <span
                    className="truncate flex-1 text-left"
                    title={file.path}
                  >
                    {file.path.split(/[/\\]/).pop()}
                  </span>
                  <span
                    className="ml-2 shrink-0 font-mono"
                    style={{ color: REFACTOR_COLOR }}
                  >
                    {formatLines(file.lineCount)} lines
                  </span>
                </button>
              );
            })}
            </div>
          </div>
          )}
        </div>
      )}
    </div>
  );
}
