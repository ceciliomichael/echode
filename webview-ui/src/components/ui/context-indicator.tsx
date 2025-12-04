import { useState, useRef } from 'react';
import { CircleDashed } from 'lucide-react';

interface ContextUsage {
  systemPromptTokens: number;
  historyTokens: number;
  toolResultsTokens: number;
  totalTokens: number;
  maxTokens: number;
  thresholdPercent: number;
}

interface ContextIndicatorProps {
  usage: ContextUsage;
  disabled?: boolean;
}

/**
 * Get color based on context usage percentage
 */
function getUsageColor(percent: number, threshold: number): string {
  if (percent >= threshold) {
    return '#ef4444'; // Red - at or above threshold
  } else if (percent >= threshold * 0.8) {
    return '#f59e0b'; // Yellow/amber - approaching threshold
  }
  return '#22c55e'; // Green - safe
}

/**
 * Format token count for display
 */
function formatTokens(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return tokens.toString();
}

export function ContextIndicator({ usage, disabled = false }: ContextIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<'above' | 'below'>('above');
  const buttonRef = useRef<HTMLButtonElement>(null);

  const usagePercent = usage.maxTokens > 0 
    ? (usage.totalTokens / usage.maxTokens) * 100 
    : 0;
  
  const color = getUsageColor(usagePercent, usage.thresholdPercent);

  // Calculate tooltip position when showing
  const calculatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceAbove = rect.top;
      // Show below if not enough space above (tooltip is ~200px tall)
      return spaceAbove < 220 ? 'below' : 'above';
    }
    return 'above';
  };

  const handleMouseEnter = () => {
    setTooltipPosition(calculatePosition());
    setShowTooltip(true);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        className="p-1 rounded-md transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ color }}
        title="Context usage"
        aria-label={`Context usage: ${usagePercent.toFixed(0)}%`}
      >
        <CircleDashed className="w-4 h-4" />
      </button>

      {showTooltip && (
        <div
          className={`absolute z-50 w-64 p-3 rounded-xl border shadow-lg ${
            tooltipPosition === 'above' ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
          style={{
            right: 0,
            backgroundColor: 'var(--vscode-editor-background)',
            borderColor: 'var(--vscode-input-border)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <span
              className="text-xs font-semibold"
              style={{ color: 'var(--vscode-foreground)' }}
            >
              Context Usage
            </span>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: `${color}20`,
                color,
              }}
            >
              {usagePercent.toFixed(1)}%
            </span>
          </div>

          {/* Progress bar */}
          <div
            className="h-2 rounded-full mb-3 overflow-hidden"
            style={{ backgroundColor: 'var(--vscode-input-border)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(usagePercent, 100)}%`,
                backgroundColor: color,
              }}
            />
          </div>

          {/* Breakdown */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span style={{ color: 'var(--vscode-descriptionForeground)' }}>
                System Prompt
              </span>
              <span style={{ color: 'var(--vscode-foreground)' }}>
                {formatTokens(usage.systemPromptTokens)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span style={{ color: 'var(--vscode-descriptionForeground)' }}>
                Chat History
              </span>
              <span style={{ color: 'var(--vscode-foreground)' }}>
                {formatTokens(usage.historyTokens)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span style={{ color: 'var(--vscode-descriptionForeground)' }}>
                Tool Results
              </span>
              <span style={{ color: 'var(--vscode-foreground)' }}>
                {formatTokens(usage.toolResultsTokens)}
              </span>
            </div>
            
            <div
              className="border-t pt-1.5 mt-1.5 flex justify-between text-xs"
              style={{ borderColor: 'var(--vscode-input-border)' }}
            >
              <span
                className="font-medium"
                style={{ color: 'var(--vscode-foreground)' }}
              >
                Total / Max
              </span>
              <span
                className="font-medium"
                style={{ color: 'var(--vscode-foreground)' }}
              >
                {formatTokens(usage.totalTokens)} / {formatTokens(usage.maxTokens)}
              </span>
            </div>
          </div>

          {/* Threshold indicator */}
          <div
            className="mt-2 pt-2 border-t text-xs"
            style={{
              borderColor: 'var(--vscode-input-border)',
              color: 'var(--vscode-descriptionForeground)',
            }}
          >
            {usagePercent >= usage.thresholdPercent ? (
              <span style={{ color: '#ef4444' }}>
                Summarization will be triggered at next tool call
              </span>
            ) : (
              <span>
                Summarization threshold: {usage.thresholdPercent}%
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
