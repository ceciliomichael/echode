import type { EchoSearchProgress } from '../../../types/tool';
import { getToolIconConfig, parseToolCall } from './utils';

/**
 * Splash texts for echo_search progress
 */
const ECHO_SEARCH_SPLASH_TEXTS = [
  'Searching codebase...',
  'Finding relevant files...',
  'Analyzing patterns...',
  'Exploring directories...',
  'Scanning for matches...',
  'Discovering context...',
];

/**
 * Progress indicator for echo_search tool - shows tools like final result snippets
 */
export function EchoSearchProgressIndicator({ progress }: { progress: EchoSearchProgress }) {
  // Pick a splash text based on iteration
  const splashText = ECHO_SEARCH_SPLASH_TEXTS[progress.iteration % ECHO_SEARCH_SPLASH_TEXTS.length];

  return (
    <div className="rounded-md overflow-hidden border border-[var(--vscode-input-border)] bg-[var(--vscode-editor-background)]">
      {/* Minimal header with splash text and wave animation */}
      <div
        className="px-3 py-1.5 border-b border-[var(--vscode-input-border)] flex items-center justify-between text-xs"
      >
        <style>
          {`
            @keyframes wave-shine {
              0% { background-position: 200% 0; }
              100% { background-position: -100% 0; }
            }
          `}
        </style>
        <span
          className="font-medium"
          style={{
            background: 'linear-gradient(90deg, var(--vscode-descriptionForeground) 0%, var(--vscode-descriptionForeground) 40%, var(--vscode-foreground) 50%, var(--vscode-descriptionForeground) 60%, var(--vscode-descriptionForeground) 100%)',
            backgroundSize: '300% 100%',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: 'wave-shine 2s linear infinite',
          }}
        >
          {splashText}
        </span>
        <span
          className="font-medium"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          {progress.iteration}/{progress.maxIterations}
        </span>
      </div>

      {/* Tool List - styled like snippet items */}
      <div>
        {progress.tools.length > 0 ? (
          progress.tools.map((toolCall, idx) => {
            const { tool, param } = parseToolCall(toolCall);
            const iconConfig = getToolIconConfig(toolCall);
            const Icon = iconConfig.icon;
            
            return (
              <div
                key={idx}
                className="flex items-center gap-2 px-3 py-2 border-b border-[var(--vscode-input-border)] last:border-b-0"
              >
                <Icon
                  className="w-3.5 h-3.5 flex-shrink-0"
                  style={{ color: iconConfig.color }}
                />
                <span
                  className="text-xs font-medium truncate flex-1"
                  style={{ color: 'var(--vscode-foreground)' }}
                >
                  {param || tool}
                </span>
                <span
                  className="text-xs opacity-50"
                  style={{ color: 'var(--vscode-descriptionForeground)' }}
                >
                  {tool}
                </span>
              </div>
            );
          })
        ) : (
          <div
            className="px-3 py-2 text-xs italic"
            style={{ color: 'var(--vscode-descriptionForeground)' }}
          >
            Analyzing codebase...
          </div>
        )}
      </div>
    </div>
  );
}
