import { Search } from 'lucide-react';
import type { TooltipPosition } from './types';

interface ScanningTooltipProps {
  tooltipPosition: TooltipPosition;
}

/**
 * Tooltip shown when scanning codebase for large files
 */
export function ScanningTooltip({ tooltipPosition }: ScanningTooltipProps) {
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
  );
}