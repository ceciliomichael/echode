import { FileCode } from 'lucide-react';
import type { RefactorIndicatorProps } from './types';
import { REFACTOR_COLOR, WAVE_ANIMATION_KEYFRAMES, formatLines } from './constants';
import { DashedProgressCircle } from './dashed-progress-circle';
import { useTooltipBehavior } from './hooks/use-tooltip-behavior';
import { EmptyStateTooltip } from './empty-state-tooltip';
import { ScanningTooltip } from './scanning-tooltip';
import { ConfirmationView } from './confirmation-view';
import { getFileIconConfig } from '../../../utils/file-icon-mapper';

/**
 * Indicator component that shows refactoring candidates (large files)
 * with a dashed progress circle and tooltip for file selection
 */
export function RefactorIndicator({ 
  largeFiles, 
  isScanning = false, 
  disabled = false, 
  onFileClick, 
  onRefactorRequest 
}: RefactorIndicatorProps) {
  const { state, handlers, refs } = useTooltipBehavior({
    onFileClick,
    onRefactorRequest,
  });

  const { showTooltip, isTopTooltip, tooltipPosition, selectedFile } = state;
  const { handleMouseEnter, handleMouseLeave, handleFileClick, handleConfirmRefactor, handleCancelRefactor } = handlers;
  const { buttonRef, containerRef } = refs;

  const fileCount = largeFiles.length;
  
  // Calculate percentage based on file count (max 10 files = 100%)
  const percent = Math.min((fileCount / 10) * 100, 100);

  // Show dimmed state when no large files and not scanning
  const isEmpty = fileCount === 0 && !isScanning;

  return (
    <div 
      ref={containerRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Wave animation keyframes for scanning state */}
      <style>{WAVE_ANIMATION_KEYFRAMES}</style>
      
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onFocus={() => state.setShowTooltip(true)}
        onBlur={() => state.setShowTooltip(false)}
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
        <EmptyStateTooltip tooltipPosition={tooltipPosition} />
      )}

      {/* Scanning tooltip */}
      {showTooltip && isScanning && (
        <ScanningTooltip tooltipPosition={tooltipPosition} />
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
            <ConfirmationView
              selectedFile={selectedFile}
              onConfirm={handleConfirmRefactor}
              onCancel={handleCancelRefactor}
            />
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