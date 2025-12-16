import { CheckCircle2 } from 'lucide-react';
import type { TooltipPosition } from './types';

interface EmptyStateTooltipProps {
  tooltipPosition: TooltipPosition;
}

/**
 * Tooltip shown when no large files are found
 */
export function EmptyStateTooltip({ tooltipPosition }: EmptyStateTooltipProps) {
  return (
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
  );
}